import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import { Message, Conversation } from '@silverfox/shared-types';
import { promisify } from 'util';
import path from 'path';
import { mkdirSync } from 'fs';

const dbPath = process.env.DATABASE_URL || './data/silverfox.db';

// Ensure directory exists
const dir = path.dirname(dbPath);
try {
  mkdirSync(dir, { recursive: true });
} catch (e) {
  // Directory may already exist
}

const db = new sqlite3.Database(dbPath);

// Properly promisify with explicit binding
const run = (sql: string, params?: any[]): Promise<sqlite3.RunResult> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params || [], function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const get = <T = any>(sql: string, params?: any[]): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params || [], (err: Error | null, row: T) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = <T = any>(sql: string, params?: any[]): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params || [], (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export async function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Conversations table
      db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_key TEXT NOT NULL,
          title TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Messages table
      db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id INTEGER NOT NULL,
          role TEXT CHECK(role IN ('user', 'assistant')) NOT NULL,
          content TEXT NOT NULL,
          token_count INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
      `);

      // Todos table (future use)
      db.run(`
        CREATE TABLE IF NOT EXISTS todos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          priority INTEGER DEFAULT 1,
          status TEXT DEFAULT 'open',
          due_date DATETIME,
          tags TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME
        )
      `);

      // Create indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_key)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

// Conversation operations
export async function createConversation(sessionKey: string, title?: string): Promise<Conversation> {
  const result = await run(
    'INSERT INTO conversations (session_key, title) VALUES (?, ?)',
    [sessionKey, title || 'New Conversation']
  );
  
  const id = result.lastID;
  
  return {
    id,
    sessionKey,
    title: title || 'New Conversation',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function getConversation(id: number): Promise<Conversation | null> {
  const row = await get<any>('SELECT * FROM conversations WHERE id = ?', [id]);
  
  if (!row) return null;
  
  return {
    id: row.id,
    sessionKey: row.session_key,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getConversations(sessionKey?: string): Promise<Conversation[]> {
  let query = `
    SELECT c.*, COUNT(m.id) as message_count 
    FROM conversations c 
    LEFT JOIN messages m ON c.id = m.conversation_id
  `;
  const params: any[] = [];
  
  if (sessionKey) {
    query += ' WHERE c.session_key = ?';
    params.push(sessionKey);
  }
  
  query += ' GROUP BY c.id ORDER BY c.updated_at DESC';
  
  const rows = await all<any>(query, params);
  
  return rows.map(row => ({
    id: row.id,
    sessionKey: row.session_key,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: row.message_count,
  }));
}

export async function updateConversationTitle(id: number, title: string): Promise<void> {
  await run(
    'UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [title, id]
  );
}

// Message operations
export async function createMessage(
  conversationId: number,
  role: 'user' | 'assistant',
  content: string,
  tokenCount?: number
): Promise<Message> {
  const result = await run(
    'INSERT INTO messages (conversation_id, role, content, token_count) VALUES (?, ?, ?, ?)',
    [conversationId, role, content, tokenCount]
  );
  
  // Update conversation timestamp
  await run(
    'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [conversationId]
  );
  
  return {
    id: result.lastID,
    conversationId,
    role,
    content,
    tokenCount,
    createdAt: new Date().toISOString(),
  };
}

export async function getMessages(conversationId: number): Promise<Message[]> {
  const rows = await all<any>(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
    [conversationId]
  );
  
  return rows.map(row => ({
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    tokenCount: row.token_count,
    createdAt: row.created_at,
  }));
}

export async function getRecentMessages(conversationId: number, limit: number = 50): Promise<Message[]> {
  const rows = await all<any>(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?',
    [conversationId, limit]
  );
  
  return rows.reverse().map(row => ({
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    tokenCount: row.token_count,
    createdAt: row.created_at,
  }));
}

export default db;
