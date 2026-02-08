import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useChatStore } from '../store/chatStore';

export function ChatInput() {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage } = useSocket();
  const { currentConversation } = useChatStore();

  const handleSubmit = () => {
    if (!content.trim()) return;
    
    sendMessage(content.trim(), currentConversation || undefined);
    setContent('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [content]);

  return (
    <div className="glass-panel p-3 flex items-end gap-3">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          rows={1}
          className="input-field w-full resize-none min-h-[44px] max-h-[200px] pr-10"
        />
        <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-royal-400" />
      </div>
      <button
        onClick={handleSubmit}
        disabled={!content.trim()}
        className="btn-primary h-[44px] px-4 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
}
