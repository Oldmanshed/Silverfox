import { useChatStore } from '../store/chatStore';
import { Wifi, WifiOff, Cpu, Hash, Clock, Zap, Menu } from 'lucide-react';

interface StatusBarProps {
  onToggleSidebar: () => void;
}

export function StatusBar({ onToggleSidebar }: StatusBarProps) {
  const { connectionStatus, status } = useChatStore();

  const formatRuntime = (runtime: string) => {
    if (!runtime || runtime === 'unknown') return '-';
    return runtime;
  };

  return (
    <div className="glass-panel px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 rounded-lg hover:bg-abyss-700/50 transition-colors"
        >
          <Menu className="w-5 h-5 text-silver-300" />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amethyst-600 to-amethyst-800 flex items-center justify-center">
            <span className="text-white font-bold text-sm">🦊</span>
          </div>
          <span className="font-semibold text-lg bg-gradient-to-r from-silver-50 to-amethyst-200 bg-clip-text text-transparent">
            Silver Fox
          </span>
        </div>

        {/* Connection Status */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            connectionStatus === 'connected'
              ? 'bg-success/10 text-success border border-success/20'
              : connectionStatus === 'connecting'
              ? 'bg-warning/10 text-warning border border-warning/20'
              : 'bg-error/10 text-error border border-error/20'
          }`}
        >
          {connectionStatus === 'connected' ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          {connectionStatus === 'connected'
            ? 'Online'
            : connectionStatus === 'connecting'
            ? 'Connecting...'
            : 'Offline'}
        </div>
      </div>

      {/* Status Metrics — hidden on mobile */}
      <div className="hidden md:flex items-center gap-4 text-sm">
        {status && (
          <>
            <div className="flex items-center gap-1.5 text-silver-300">
              <Zap className="w-4 h-4 text-amethyst-400" />
              <span className="text-silver-100 font-medium">
                {status.model || 'Unknown'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-silver-300">
              <Hash className="w-4 h-4 text-amethyst-400" />
              <span className="text-silver-100 font-medium">
                {status.totalTokens.toLocaleString()}
              </span>
              <span>tokens</span>
            </div>

            <div className="flex items-center gap-1.5 text-silver-300">
              <Clock className="w-4 h-4 text-amethyst-400" />
              <span className="text-silver-100 font-medium">
                {formatRuntime(status.runtime)}
              </span>
            </div>

            {status.channel && (
              <div className="flex items-center gap-1.5 text-silver-300">
                <Cpu className="w-4 h-4 text-amethyst-400" />
                <span className="text-silver-100 font-medium capitalize">
                  {status.channel}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
