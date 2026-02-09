import React from 'react';
import { useChatStore } from '../store/chatStore';
import { User, Bot } from 'lucide-react';

export function MessageList() {
  const { messages, isTyping } = useChatStore();
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 overflow-y-auto space-y-4 p-4 scrollbar-thin">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-silver-300">
          <div className="w-16 h-16 rounded-full bg-amethyst-900/40 flex items-center justify-center mb-4">
            <Bot className="w-8 h-8 text-amethyst-400" />
          </div>
          <p className="text-lg font-medium text-silver-100">Welcome to Silver Fox</p>
          <p className="text-sm mt-2 text-silver-400">Start a conversation with your OpenClaw agent</p>
        </div>
      )}

      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex gap-3 animate-slide-up ${
            message.role === 'user' ? 'flex-row-reverse' : ''
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              message.role === 'user'
                ? 'bg-gradient-to-br from-amethyst-600 to-amethyst-700'
                : 'bg-abyss-600/60 border border-abyss-500/30'
            }`}
          >
            {message.role === 'user' ? (
              <User className="w-4 h-4 text-white" />
            ) : (
              <Bot className="w-4 h-4 text-amethyst-400" />
            )}
          </div>

          <div
            className={`max-w-[80%] ${
              message.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`rounded-2xl px-4 py-2.5 ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-amethyst-600 to-amethyst-700 text-white rounded-br-md'
                  : 'glass-card text-silver-100 rounded-bl-md'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            </div>
            <span className="text-xs text-silver-500 mt-1 px-1">
              {formatTime(message.createdAt)}
              {message.tokenCount && (
                <span className="ml-2">· {message.tokenCount} tokens</span>
              )}
            </span>
          </div>
        </div>
      ))}

      {isTyping && (
        <div className="flex gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-full bg-abyss-600/60 border border-abyss-500/30 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-amethyst-400" />
          </div>
          <div className="glass-card rounded-2xl rounded-bl-md px-4 py-3">
            <div className="flex gap-1">
              <span
                className="w-2 h-2 rounded-full bg-amethyst-400 animate-bounce-dots"
                style={{ animationDelay: '0s' }}
              />
              <span
                className="w-2 h-2 rounded-full bg-amethyst-400 animate-bounce-dots"
                style={{ animationDelay: '0.2s' }}
              />
              <span
                className="w-2 h-2 rounded-full bg-amethyst-400 animate-bounce-dots"
                style={{ animationDelay: '0.4s' }}
              />
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
