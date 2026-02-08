import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatStore } from '../store/chatStore';
import { ServerToClientEvents, ClientToServerEvents } from '@silverfox/shared-types';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function useSocket() {
  const { 
    addMessage, 
    setIsTyping, 
    setConnectionStatus, 
    setStatus 
  } = useChatStore();
  
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  useEffect(() => {
    if (!socket) {
      socket = io(window.location.origin, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;
    }

    const s = socket;

    s.on('connect', () => {
      console.log('Connected to Silver Fox');
      setConnectionStatus('connected');
      s.emit('status:request');
    });

    s.on('disconnect', () => {
      console.log('Disconnected from Silver Fox');
      setConnectionStatus('disconnected');
    });

    s.on('connect_error', () => {
      setConnectionStatus('disconnected');
    });

    s.on('chat:message', (message) => {
      addMessage(message);
    });

    s.on('chat:typing', ({ isTyping }) => {
      setIsTyping(isTyping);
    });

    s.on('status:update', (status) => {
      setStatus(status);
    });

    s.on('connection:status', ({ connected, message }) => {
      setConnectionStatus(connected ? 'connected' : 'disconnected');
      if (message) {
        console.warn('Connection status:', message);
      }
    });

    return () => {
      // Don't disconnect on unmount, keep socket alive
    };
  }, [addMessage, setIsTyping, setConnectionStatus, setStatus]);

  const sendMessage = (content: string, conversationId?: number) => {
    if (socket?.connected) {
      socket.emit('chat:send', { content, conversationId });
    }
  };

  return {
    socket: socketRef.current,
    sendMessage,
  };
}
