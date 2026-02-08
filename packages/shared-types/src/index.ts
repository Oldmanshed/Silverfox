// Message types for chat
export interface Message {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant';
  content: string;
  tokenCount?: number;
  createdAt: string;
}

export interface Conversation {
  id: number;
  sessionKey: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

// OpenClaw status
export interface OpenClawStatus {
  connected: boolean;
  sessionKey: string;
  model?: string;
  totalTokens: number;
  runtime: string;
  channel?: string;
  lastMessage?: string;
}

// WebSocket events
export interface ServerToClientEvents {
  'chat:message': (message: Message) => void;
  'chat:typing': (data: { isTyping: boolean }) => void;
  'status:update': (status: OpenClawStatus) => void;
  'connection:status': (data: { connected: boolean; message?: string }) => void;
}

export interface ClientToServerEvents {
  'chat:send': (data: { content: string; conversationId?: number }) => void;
  'chat:history': (data: { conversationId: number }) => void;
  'status:request': () => void;
}

// Todo types (future)
export interface Todo {
  id: number;
  title: string;
  description?: string;
  priority: 0 | 1 | 2; // low, normal, high
  status: 'open' | 'in_progress' | 'done';
  dueDate?: string;
  tags: string[];
  createdAt: string;
  completedAt?: string;
}

// API responses
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ChatSendRequest {
  content: string;
  conversationId?: number;
}

export interface ChatHistoryResponse {
  messages: Message[];
  conversation: Conversation;
}
