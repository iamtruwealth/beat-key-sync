import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Activity, Play, Pause, Radio, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGhostUIReceiver } from '@/hooks/useGhostUIReceiver';

interface GhostUIProps {
  sessionId: string;
  className?: string;
}

export const GhostUI: React.FC<GhostUIProps> = ({ sessionId, className }) => {
  const { ghostState, clipTriggers, padPresses, isConnected, lastUpdateTime } = useGhostUIReceiver({
    sessionId,
    isViewer: true,
    enabled: true,
  });

  const timeSinceLastUpdate = Date.now() - lastUpdateTime;
  const isStale = timeSinceLastUpdate > 3000; // Consider stale if no update in 3s

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Radio className={cn("h-5 w-5", isConnected && !isStale ? "text-green-500" : "text-muted-foreground")} />
              Ghost UI - Viewer Mode
            </CardTitle>
            <Badge variant={isConnected && !isStale ? "default" : "secondary"}>
              {isConnected && !isStale ? "LIVE" : "WAITING FOR HOST"}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Playback State */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Playback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {ghostState.isPlaying ? (
                <Play className="h-5 w-5 text-green-500 fill-green-500" />
              ) : (
                <Pause className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">
                {ghostState.isPlaying ? 'Playing' : 'Stopped'}
              </span>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-mono">
                {ghostState.playheadPosition.toFixed(2)} beats
              </span>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-mono">
                {ghostState.bpm} BPM
              </span>
            </div>
          </div>

          {/* Visual Playhead */}
          <div className="relative w-full h-12 bg-background rounded-lg border overflow-hidden">
            <div className="absolute inset-0 flex items-center">
              {/* Grid lines */}
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-full border-l",
                    i % 4 === 0 ? "border-border" : "border-border/30"
                  )}
                  style={{ left: `${(i / 16) * 100}%`, position: 'absolute' }}
                />
              ))}
            </div>
            
            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-lg shadow-primary/50 z-10 transition-all duration-50"
              style={{
                left: `${((ghostState.playheadPosition % 16) / 16) * 100}%`,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Loop Region */}
      {ghostState.loopRegion && ghostState.loopRegion.enabled && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Loop Region</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {ghostState.loopRegion.start} → {ghostState.loopRegion.end} beats
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Clip Triggers */}
          {clipTriggers.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground font-medium">Clip Triggers</div>
              {clipTriggers.slice(-3).reverse().map((trigger, idx) => (
                <div
                  key={`${trigger.time}-${idx}`}
                  className="text-xs px-2 py-1 bg-primary/10 rounded flex items-center justify-between animate-in fade-in slide-in-from-bottom-2"
                >
                  <span>Track: {trigger.trackId.slice(0, 8)}...</span>
                  <span className="text-muted-foreground">
                    {new Date(trigger.time).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pad Presses */}
          {padPresses.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground font-medium">Pad Presses</div>
              {padPresses.slice(-3).reverse().map((press, idx) => (
                <div
                  key={`${press.time}-${idx}`}
                  className="text-xs px-2 py-1 bg-accent/10 rounded flex items-center justify-between animate-in fade-in slide-in-from-bottom-2"
                >
                  <span>Pad: {press.padId}</span>
                  <span className="text-muted-foreground">
                    Velocity: {press.velocity}
                  </span>
                </div>
              ))}
            </div>
          )}

          {clipTriggers.length === 0 && padPresses.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-4">
              No recent activity
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline Info */}
      {ghostState.timeline && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Zoom:</span>
              <span>{(ghostState.timeline.zoom * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Scroll:</span>
              <span>{ghostState.timeline.scroll.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Clips */}
      {ghostState.activeClips && ghostState.activeClips.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Clips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {ghostState.activeClips.map((clipId) => (
                <Badge key={clipId} variant="outline">
                  {clipId.slice(0, 8)}...
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* OBS Instructions */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">Audio from OBS/HLS stream</p>
            <p className="text-xs">
              This is a visual-only representation. Audio is handled by the host's OBS broadcast.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
