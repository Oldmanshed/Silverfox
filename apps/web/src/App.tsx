import { useEffect, useState } from 'react';
import { StatusBar } from './components/StatusBar';
import { Sidebar } from './components/Sidebar';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { useSocket } from './hooks/useSocket';
import { useChatStore } from './store/chatStore';

function App() {
  const { connectionStatus } = useChatStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useSocket();

  // Initialize with a default conversation
  useEffect(() => {
    fetch('/api/conversations')
      .then(res => res.json())
      .then(data => {
        useChatStore.getState().setConversations(data);
        if (data.length > 0) {
          useChatStore.getState().setCurrentConversation(data[0].id);
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
    <div className="h-screen w-full flex flex-col bg-abyss-950 overflow-hidden relative" style={{ minWidth: '100vw', minHeight: '100vh' }}>
      {/* Ambient background layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3 hidden md:block" />
      </div>

      {/* UI layer */}
      <div className="relative flex flex-col h-full" style={{ zIndex: 10 }}>
        <StatusBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <div className="flex-1 flex flex-row overflow-hidden p-4 gap-4" style={{ display: 'flex', flexDirection: 'row' }}>
          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm lg:hidden"
              style={{ zIndex: 20 }}
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div
            className={`
              fixed top-0 left-0 h-full w-72 lg:relative lg:w-72 lg:h-auto
              transition-transform duration-300 ease-out
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}
            style={{ zIndex: 30, flexShrink: 0 }}
          >
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>

          <main className="flex-1 glass-panel flex flex-col overflow-hidden" style={{ flex: '1 1 0%', minWidth: 0 }}>
            {connectionStatus === 'disconnected' && (
              <div className="bg-error/10 border-b border-error/20 px-4 py-2 text-sm text-error flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-error animate-glow-pulse" />
                Disconnected from server. Trying to reconnect...
              </div>
            )}

            <MessageList />

            <div className="p-4 border-t border-abyss-600/30">
              <ChatInput />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
