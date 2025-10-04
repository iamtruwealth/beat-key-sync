import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Radio, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGhostUIReceiver } from '@/hooks/useGhostUIReceiver';
import { useAudioReceiver } from '@/hooks/useAudioReceiver';

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

  const { isConnected: audioConnected, isPlaying: audioPlaying, audioUnlocked, unlockAudio } = useAudioReceiver({
    sessionId,
    isViewer: true,
    enabled: true,
  });

  const timeSinceLastUpdate = Date.now() - lastUpdateTime;
  const isStale = timeSinceLastUpdate > 3000;
  const overlayActive = !audioUnlocked;

  return (
    <div className={cn("flex flex-col h-full relative", className)}>
      {/* Ghost UI Banner */}
      <div className="bg-gradient-to-r from-neon-cyan/20 to-electric-blue/20 border-b border-neon-cyan/30 p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio className={cn("h-4 w-4", isConnected && !isStale ? "text-green-500 animate-pulse" : "text-muted-foreground")} />
            <span className="text-sm font-medium">Ghost UI - Viewer Mode</span>
            <Volume2 className={cn("h-4 w-4", audioConnected && audioPlaying ? "text-green-500 animate-pulse" : "text-muted-foreground")} />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={audioConnected ? "default" : "secondary"} className="text-xs">
              {audioConnected ? "🔊 AUDIO" : "🔇 NO AUDIO"}
            </Badge>
            <Badge variant={isConnected && !isStale ? "default" : "secondary"} className="text-xs">
              {isConnected && !isStale ? "🔴 LIVE" : "⏸ WAITING"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Audio Unlock Overlay */}
      {!audioUnlocked && (
        <div
          className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
          onClick={() => unlockAudio?.()}
        >
          <div className="max-w-md p-8 bg-card border border-border rounded-lg shadow-lg text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <Volume2 className="w-16 h-16 mx-auto text-primary animate-pulse" />
            <h2 className="text-2xl font-bold">Enable Audio</h2>
            <p className="text-muted-foreground">
              Click the button below to unlock audio streaming for this session.
            </p>
            <Button
              onClick={unlockAudio}
              className="w-full"
            >
              🔊 Enable Audio
            </Button>
          </div>
        </div>
      )}

      {/* Full Cook Mode UI (read-only) */}
      <div className={cn("flex-1 overflow-hidden", overlayActive ? "pointer-events-none select-none" : "")}>
        {children}
      </div>
    </div>
  );
};
