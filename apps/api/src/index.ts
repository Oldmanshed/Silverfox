import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { initDatabase, getConversations, getMessages, getConversation, createConversation } from './db.js';
import { initSocketIO } from './socket.js';
import { getSessionStatus } from './openclaw.js';

dotenv.config();

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database and server
async function startServer() {
  try {
    // Initialize database
    await initDatabase();
    console.log('✅ Database initialized');

    // Initialize Socket.IO
    initSocketIO(server);

    // Health check
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Get OpenClaw status
    app.get('/api/status', async (req, res) => {
      const status = await getSessionStatus();
      res.json(status);
    });

    // Get conversations
    app.get('/api/conversations', async (req, res) => {
      try {
        const sessionKey = req.query.sessionKey as string;
        const conversations = await getConversations(sessionKey);
        res.json(conversations);
      } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
      }
    });

    // Get single conversation
    app.get('/api/conversations/:id', async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const conversation = await getConversation(id);
        
        if (!conversation) {
          return res.status(404).json({ error: 'Conversation not found' });
        }
        
        res.json(conversation);
      } catch (error) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({ error: 'Failed to fetch conversation' });
      }
    });

    // Create conversation
    app.post('/api/conversations', async (req, res) => {
      try {
        const { sessionKey, title } = req.body;
        const conversation = await createConversation(
          sessionKey || process.env.SESSION_KEY || 'agent:main:main',
          title
        );
        res.json(conversation);
      } catch (error) {
        console.error('Error creating conversation:', error);
        res.status(500).json({ error: 'Failed to create conversation' });
      }
    });

    // Get messages for conversation
    app.get('/api/conversations/:id/messages', async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const messages = await getMessages(id);
        res.json(messages);
      } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
      }
    });

    const PORT = process.env.PORT || 3456;

    server.listen(PORT, () => {
      console.log(`🦊 Silver Fox API running on port ${PORT}`);
      console.log(`📊 Database: ${process.env.DATABASE_URL || '/data/silverfox.db'}`);
      console.log(`🔗 OpenClaw: ${process.env.OPENCLAW_URL || 'http://localhost:8080'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
