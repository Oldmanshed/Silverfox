import express, { Request, Response, NextFunction } from 'express';
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
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

// Error handler middleware
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation helpers
const validateConversationId = (id: string): number | null => {
  const num = parseInt(id, 10);
  return isNaN(num) || num <= 0 ? null : num;
};

const validateString = (value: unknown, maxLength: number = 1000): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
};

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
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '0.1.0'
      });
    });

    // Get OpenClaw status
    app.get('/api/status', asyncHandler(async (req, res) => {
      const status = await getSessionStatus();
      res.json(status);
    }));

    // Get conversations
    app.get('/api/conversations', asyncHandler(async (req, res) => {
      const sessionKey = validateString(req.query.sessionKey as string, 100) || undefined;
      const conversations = await getConversations(sessionKey);
      res.json(conversations);
    }));

    // Get single conversation
    app.get('/api/conversations/:id', asyncHandler(async (req, res) => {
      const id = validateConversationId(req.params.id);
      
      if (id === null) {
        return res.status(400).json({ error: 'Invalid conversation ID' });
      }
      
      const conversation = await getConversation(id);
      
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      res.json(conversation);
    }));

    // Create conversation
    app.post('/api/conversations', asyncHandler(async (req, res) => {
      const sessionKey = validateString(req.body.sessionKey, 100) || process.env.SESSION_KEY || 'agent:main:main';
      const title = validateString(req.body.title, 200);
      
      const conversation = await createConversation(sessionKey, title);
      res.status(201).json(conversation);
    }));

    // Get messages for conversation
    app.get('/api/conversations/:id/messages', asyncHandler(async (req, res) => {
      const id = validateConversationId(req.params.id);
      
      if (id === null) {
        return res.status(400).json({ error: 'Invalid conversation ID' });
      }
      
      const conversation = await getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      const messages = await getMessages(id);
      res.json(messages);
    }));

    // Global error handler
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('API Error:', err);
      res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    const PORT = process.env.PORT || 3456;

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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
