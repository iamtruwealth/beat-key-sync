import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGhostUIReceiver } from '@/hooks/useGhostUIReceiver';

interface GhostUIProps {
  sessionId: string;
  className?: string;
  children: React.ReactNode;
}

export const GhostUI: React.FC<GhostUIProps> = ({ sessionId, className, children }) => {
  const { isConnected, lastUpdateTime } = useGhostUIReceiver({
    sessionId,
    isViewer: true,
    enabled: true,
  });

  const timeSinceLastUpdate = Date.now() - lastUpdateTime;
  const isStale = timeSinceLastUpdate > 3000;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Ghost UI Banner */}
      <div className="bg-gradient-to-r from-neon-cyan/20 to-electric-blue/20 border-b border-neon-cyan/30 p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className={cn("h-4 w-4", isConnected && !isStale ? "text-green-500 animate-pulse" : "text-muted-foreground")} />
            <span className="text-sm font-medium">Ghost UI - Viewer Mode</span>
          </div>
          <Badge variant={isConnected && !isStale ? "default" : "secondary"} className="text-xs">
            {isConnected && !isStale ? "🔴 LIVE" : "⏸ WAITING"}
          </Badge>
        </div>
      </div>

      {/* Full Cook Mode UI (read-only) */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
};
