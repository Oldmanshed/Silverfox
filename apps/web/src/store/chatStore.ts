import { create } from 'zustand';
import { Message, Conversation, OpenClawStatus } from '@silverfox/shared-types';

interface ChatState {
  messages: Message[];
  conversations: Conversation[];
  currentConversation: number | null;
  isTyping: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  status: OpenClawStatus | null;
  
  // Actions
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (id: number | null) => void;
  setIsTyping: (isTyping: boolean) => void;
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'connecting') => void;
  setStatus: (status: OpenClawStatus | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  conversations: [],
  currentConversation: null,
  isTyping: false,
  connectionStatus: 'connecting',
  status: null,

  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),
  setConversations: (conversations) => set({ conversations }),
  setCurrentConversation: (id) => set({ currentConversation: id }),
  setIsTyping: (isTyping) => set({ isTyping }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setStatus: (status) => set({ status }),
}));
