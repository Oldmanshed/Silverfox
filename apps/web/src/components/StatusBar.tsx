import { useChatStore } from '../store/chatStore';
import { Wifi, WifiOff, Cpu, Hash, Clock, Zap } from 'lucide-react';

export function StatusBar() {
  const { connectionStatus, status } = useChatStore();

  const formatRuntime = (runtime: string) => {
    if (!runtime || runtime === 'unknown') return '-';
    // Parse "Xh Ym Zs" format
    return runtime;
  };

  return (
    <div className="glass-panel px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-royal-600 to-royal-800 flex items-center justify-center">
            <span className="text-white font-bold text-lg">🦊</span>
          </div>
          <span className="font-semibold text-lg bg-gradient-to-r from-white to-royal-200 bg-clip-text text-transparent">
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

      {/* Status Metrics */}
      <div className="flex items-center gap-4 text-sm">
        {status && (
          <>
            <div className="flex items-center gap-1.5 text-text-secondary">
              <Zap className="w-4 h-4 text-royal-400" />
              <span className="text-text-primary font-medium">
                {status.model || 'Unknown'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-text-secondary">
              <Hash className="w-4 h-4 text-royal-400" />
              <span className="text-text-primary font-medium">
                {status.totalTokens.toLocaleString()}
              </span>
              <span>tokens</span>
            </div>

            <div className="flex items-center gap-1.5 text-text-secondary">
              <Clock className="w-4 h-4 text-royal-400" />
              <span className="text-text-primary font-medium">
                {formatRuntime(status.runtime)}
              </span>
            </div>

            {status.channel && (
              <div className="flex items-center gap-1.5 text-text-secondary">
                <Cpu className="w-4 h-4 text-royal-400" />
                <span className="text-text-primary font-medium capitalize">
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
