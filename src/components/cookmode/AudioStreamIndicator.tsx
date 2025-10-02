import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Radio, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AudioStreamIndicatorProps {
  isHost: boolean;
  isStreaming: boolean;
  audioLevel: number;
  onToggleStream?: () => void;
}

export const AudioStreamIndicator: React.FC<AudioStreamIndicatorProps> = ({
  isHost,
  isStreaming,
  audioLevel,
  onToggleStream
}) => {
  return (
    <Card className="bg-card/30 border-border/50">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {isHost ? (
            <>
              <Button
                variant={isStreaming ? "default" : "outline"}
                size="sm"
                onClick={onToggleStream}
                className={isStreaming ? "bg-red-500 hover:bg-red-600" : ""}
              >
                {isStreaming ? (
                  <>
                    <Mic className="w-4 h-4 mr-2" />
                    Stop Streaming
                  </>
                ) : (
                  <>
                    <MicOff className="w-4 h-4 mr-2" />
                    Start Audio Stream
                  </>
                )}
              </Button>

              {isStreaming && (
                <>
                  <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10 gap-2">
                    <Radio className="w-3 h-3 animate-pulse" />
                    LIVE
                  </Badge>
                  
                  {/* Audio Level Meter */}
                  <div className="flex-1 max-w-32">
                    <div className="h-2 bg-background/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-100"
                        style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 text-neon-cyan" />
              <span className="text-sm text-foreground">
                {isStreaming ? "Receiving audio from host" : "Waiting for host to start streaming"}
              </span>
              {isStreaming && (
                <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10">
                  Connected
                </Badge>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
