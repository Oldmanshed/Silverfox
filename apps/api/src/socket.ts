import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@silverfox/shared-types';
import { getSessionStatus, sendMessage, getSessionHistory } from './openclaw.js';
import { createMessage, getMessages, updateConversationTitle } from './db.js';

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

export function initSocketIO(server: HTTPServer) {
  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
      origin: process.env.WS_CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send initial status
    sendStatusUpdate(socket);

    // Handle chat messages
    socket.on('chat:send', async (data) => {
      const { content, conversationId } = data;
      
      try {
        // Save user message to database
        const conversation = conversationId || 1; // Default to first conversation
        const userMessage = await createMessage(conversation, 'user', content);
        
        // Broadcast to all clients
        io.emit('chat:message', userMessage);
        
        // Show typing indicator
        io.emit('chat:typing', { isTyping: true });
        
        // Send to OpenClaw
        const sent = await sendMessage(content);
        
        if (!sent) {
          io.emit('chat:typing', { isTyping: false });
          io.emit('connection:status', { 
            connected: false, 
            message: 'Failed to send message to OpenClaw' 
          });
          return;
        }

        // Poll for response (simple approach for MVP)
        setTimeout(async () => {
          try {
            const history = await getSessionHistory(5);
            if (history && history.messages && Array.isArray(history.messages)) {
              // Find the most recent assistant message
              const lastAssistant = history.messages
                .reverse()
                .find((m) => m.role === 'assistant');
              
              if (lastAssistant) {
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
                  const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
                  await updateConversationTitle(conversation, title);
                }
              }
            }
          } catch (error) {
            console.error('Error polling for response:', error);
          } finally {
            io.emit('chat:typing', { isTyping: false });
            sendStatusUpdate();
          }
        }, 2000); // Poll after 2 seconds

      } catch (error) {
        console.error('Error handling chat:send:', error);
        socket.emit('connection:status', { 
          connected: false, 
          message: 'Internal server error' 
        });
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
