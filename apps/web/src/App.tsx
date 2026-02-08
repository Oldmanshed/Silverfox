import { useEffect } from 'react';
import { StatusBar } from './components/StatusBar';
import { Sidebar } from './components/Sidebar';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { useSocket } from './hooks/useSocket';
import { useChatStore } from './store/chatStore';

function App() {
  const { connectionStatus } = useChatStore();
  useSocket();

  // Initialize with a default conversation
  useEffect(() => {
    // Fetch initial conversations
    fetch('/api/conversations')
      .then(res => res.json())
      .then(data => {
        useChatStore.getState().setConversations(data);
        if (data.length > 0) {
          useChatStore.getState().setCurrentConversation(data[0].id);
          // Load messages for first conversation
          return fetch(`/api/conversations/${data[0].id}/messages`);
        }
      })
      .then(res => res?.json())
      .then(messages => {
        if (messages) {
          useChatStore.getState().setMessages(messages);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <div className="h-screen w-full flex flex-col bg-void-900 overflow-hidden" style={{ minWidth: '100vw', minHeight: '100vh' }}>
      <StatusBar />
      
      <div className="flex-1 flex flex-row overflow-hidden p-3 gap-3" style={{ display: 'flex', flexDirection: 'row' }}>
        <div style={{ flexShrink: 0 }}><Sidebar /></div>
        
        <main className="flex-1 glass-panel flex flex-col overflow-hidden" style={{ flex: '1 1 0%', minWidth: 0 }}>
          {connectionStatus === 'disconnected' && (
            <div className="bg-error/10 border-b border-error/20 px-4 py-2 text-sm text-error flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
              Disconnected from server. Trying to reconnect...
            </div>
          )}
          
          <MessageList />
          
          <div className="p-4 border-t border-void-600/50">
            <ChatInput />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
