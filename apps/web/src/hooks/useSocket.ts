import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatStore } from '../store/chatStore';
import { ServerToClientEvents, ClientToServerEvents } from '@silverfox/shared-types';

export function useSocket() {
  const { 
    addMessage, 
    setIsTyping, 
    setConnectionStatus, 
    setStatus 
  } = useChatStore();
  
  // Use ref to track if we've initialized
  const initialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (initialized.current) return;
    initialized.current = true;

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    const handleConnect = () => {
      console.log('Connected to Silver Fox');
      setConnectionStatus('connected');
      socket.emit('status:request');
    };

    const handleDisconnect = () => {
      console.log('Disconnected from Silver Fox');
      setConnectionStatus('disconnected');
    };

    const handleConnectError = () => {
      setConnectionStatus('disconnected');
    };

    const handleChatMessage = (message: any) => {
      addMessage(message);
    };

    const handleTyping = ({ isTyping }: { isTyping: boolean }) => {
      setIsTyping(isTyping);
    };

    const handleStatusUpdate = (status: any) => {
      setStatus(status);
    };

    const handleConnectionStatus = ({ connected, message }: { connected: boolean; message?: string }) => {
      setConnectionStatus(connected ? 'connected' : 'disconnected');
      if (message) {
        console.warn('Connection status:', message);
      }
    };

    // Register listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('chat:message', handleChatMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('status:update', handleStatusUpdate);
    socket.on('connection:status', handleConnectionStatus);

    // Cleanup on unmount
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('chat:message', handleChatMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('status:update', handleStatusUpdate);
      socket.off('connection:status', handleConnectionStatus);
      socket.disconnect();
    };
  }, [addMessage, setIsTyping, setConnectionStatus, setStatus]);

  const sendMessage = (content: string, conversationId?: number) => {
    // Get socket instance
    const socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });
    
    if (socket.connected) {
      socket.emit('chat:send', { content, conversationId });
    } else {
      console.error('Socket not connected');
      setConnectionStatus('disconnected');
    }
  };

  return { sendMessage };
}
