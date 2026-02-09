import { useChatStore } from '../store/chatStore';
import { MessageSquare, Plus, Clock, X } from 'lucide-react';

interface SidebarProps {
  onClose: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const { conversations, currentConversation, setCurrentConversation } = useChatStore();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleConversationClick = (id: number) => {
    setCurrentConversation(id);
    onClose();
  };

  return (
    <div className="w-72 glass-panel flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-abyss-600/30">
        <div className="flex items-center justify-between lg:justify-center">
          <button className="btn-primary w-full flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            New Chat
          </button>
          <button
            onClick={onClose}
            className="lg:hidden ml-2 p-1.5 rounded-lg hover:bg-abyss-700/50 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-silver-400" />
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
        {conversations.length === 0 && (
          <div className="text-center py-8 text-silver-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
          </div>
        )}

        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => handleConversationClick(conversation.id)}
            className={`w-full text-left p-3 rounded-xl transition-all duration-200 group ${
              currentConversation === conversation.id
                ? 'bg-amethyst-700/20 border border-amethyst-600/30'
                : 'hover:bg-abyss-700/40 border border-transparent'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                currentConversation === conversation.id
                  ? 'bg-amethyst-700/30'
                  : 'bg-abyss-600/50'
              }`}>
                <MessageSquare className={`w-4 h-4 ${
                  currentConversation === conversation.id
                    ? 'text-amethyst-300'
                    : 'text-amethyst-400'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-silver-100 truncate">
                  {conversation.title}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-silver-500">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(conversation.updatedAt)}</span>
                  {conversation.messageCount !== undefined && (
                    <>
                      <span>·</span>
                      <span>{conversation.messageCount} messages</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-abyss-600/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amethyst-600 to-amethyst-800 flex items-center justify-center">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-silver-100">Ryan</p>
            <p className="text-xs text-silver-500">OpenClaw Admin</p>
          </div>
        </div>
      </div>
    </div>
  );
}
