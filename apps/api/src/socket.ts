import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@silverfox/shared-types';
import { getSessionStatus, sendMessage, getSessionHistory } from './openclaw.js';
import { createMessage, getMessages, updateConversationTitle, getConversation, getConversations, createConversation } from './db.js';

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

// Track processed assistant responses by content hash to prevent duplicates
const processedResponses = new Set<string>();
const RESPONSE_CACHE_SIZE = 100;

export function initSocketIO(server: HTTPServer) {
  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
      origin: process.env.WS_CORS_ORIGIN || process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send initial status
    sendStatusUpdate(socket);

    // Handle chat messages
    socket.on('chat:send', async (data) => {
      const { content, conversationId } = data;
      
      // Validate input
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        socket.emit('connection:status', { 
          connected: false, 
          message: 'Invalid message content' 
        });
        return;
      }

      if (content.length > 10000) {
        socket.emit('connection:status', { 
          connected: false, 
          message: 'Message too long (max 10000 chars)' 
        });
        return;
      }
      
      try {
        const trimmedContent = content.trim();
        
        // Validate conversation ID
        let conversation: number;
        if (conversationId !== undefined) {
          const parsed = parseInt(String(conversationId), 10);
          if (isNaN(parsed) || parsed <= 0) {
            socket.emit('connection:status', { 
              connected: false, 
              message: 'Invalid conversation ID' 
            });
            return;
          }
          // Verify conversation exists
          const conv = await getConversation(parsed);
          if (!conv) {
            socket.emit('connection:status', { 
              connected: false, 
              message: 'Conversation not found' 
            });
            return;
          }
          conversation = parsed;
        } else {
          // Get or create default conversation
          const conversations = await getConversations();
          if (conversations.length > 0) {
            conversation = conversations[0].id;
          } else {
            const newConv = await createConversation(
              process.env.SESSION_KEY || 'agent:main:main',
              'New Chat'
            );
            conversation = newConv.id;
          }
        }
        
        // Save user message to database
        const userMessage = await createMessage(conversation, 'user', trimmedContent);
        
        // Broadcast to all clients
        io.emit('chat:message', userMessage);
        
        // Show typing indicator
        io.emit('chat:typing', { isTyping: true });
        
        // Send to OpenClaw
        const sent = await sendMessage(trimmedContent);
        
        if (!sent) {
          io.emit('chat:typing', { isTyping: false });
          io.emit('connection:status', { 
            connected: false, 
            message: 'Failed to send message to OpenClaw' 
          });
          return;
        }

        // Poll for response with timeout
        const startTime = Date.now();
        const maxWait = 30000; // 30 seconds max
        let responseReceived = false;
        
        const pollInterval = setInterval(async () => {
          try {
            if (responseReceived) {
              clearInterval(pollInterval);
              return;
            }
            
            if (Date.now() - startTime > maxWait) {
              clearInterval(pollInterval);
              io.emit('chat:typing', { isTyping: false });
              io.emit('connection:status', { 
                connected: true, 
                message: 'Response timeout - OpenClaw may be processing' 
              });
              return;
            }
            
            const history = await getSessionHistory(10);
            if (history && history.messages && Array.isArray(history.messages)) {
              // Find the most recent assistant message that we haven't processed
              const lastAssistant = history.messages
                .reverse()
                .find((m) => m.role === 'assistant');
              
              if (lastAssistant && !responseReceived) {
                // Deduplicate by content hash (conversation + content)
                const responseKey = `${conversation}:${lastAssistant.content}`;
                if (processedResponses.has(responseKey)) {
                  console.log('Duplicate assistant response prevented');
                  responseReceived = true;
                  clearInterval(pollInterval);
                  io.emit('chat:typing', { isTyping: false });
                  return;
                }
                processedResponses.add(responseKey);

                // Clean up old response hashes
                if (processedResponses.size > RESPONSE_CACHE_SIZE) {
                  const iterator = processedResponses.values();
                  for (let i = 0; i < RESPONSE_CACHE_SIZE / 2; i++) {
                    const value = iterator.next().value;
                    if (value) processedResponses.delete(value);
                  }
                }

                responseReceived = true;
                clearInterval(pollInterval);

                const assistantMessage = await createMessage(
                  conversation,
                  'assistant',
                  lastAssistant.content,
                  lastAssistant.tokens
                );
                io.emit('chat:message', assistantMessage);
                
                // Update conversation title on first exchange
                const messages = await getMessages(conversation);
                if (messages.length <= 2) {
                  const title = trimmedContent.slice(0, 50) + (trimmedContent.length > 50 ? '...' : '');
                  await updateConversationTitle(conversation, title);
                  io.emit('conversations:updated'); // Notify clients to refresh list
                }
                
                io.emit('chat:typing', { isTyping: false });
                sendStatusUpdate();
              }
            }
          } catch (error) {
            console.error('Error polling for response:', error);
            clearInterval(pollInterval);
            io.emit('chat:typing', { isTyping: false });
          }
        }, 1000); // Poll every second instead of single 2s delay

      } catch (error) {
        console.error('Error handling chat:send:', error);
        socket.emit('connection:status', { 
          connected: false, 
          message: 'Internal server error' 
        });
        io.emit('chat:typing', { isTyping: false });
      }
    });

    // Handle status requests
    socket.on('status:request', () => {
      sendStatusUpdate(socket);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Periodic status updates
  setInterval(() => {
    sendStatusUpdate();
  }, 5000);

  return io;
}

async function sendStatusUpdate(target?: any) {
  try {
    const status = await getSessionStatus();
    if (status) {
      if (target) {
        target.emit('status:update', status);
      } else {
        io.emit('status:update', status);
      }
    }
  } catch (error) {
    console.error('Error sending status update:', error);
  }
}

export { io };
