import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Video, VideoOff, Mic, MicOff, Monitor, MonitorX } from 'lucide-react';
import { useWebRTCStreaming } from '@/hooks/useWebRTCStreaming';

interface VideoStreamingPanelProps {
  sessionId: string;
  canEdit: boolean;
  currentUserId?: string;
}

export const VideoStreamingPanel: React.FC<VideoStreamingPanelProps> = ({
  sessionId,
  canEdit,
  currentUserId
}) => {
  const {
    localStream,
    participants,
    isStreaming,
    streamEnabled,
    localVideoRef,
    startStreaming,
    stopStreaming,
    toggleVideo,
    toggleAudio
  } = useWebRTCStreaming({ sessionId, canEdit, currentUserId });

  return (
    <div className="h-full flex flex-col bg-background/50 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Live Stream</h3>
            <p className="text-sm text-muted-foreground">
              {participants.length} participant{participants.length !== 1 ? 's' : ''} connected
            </p>
          </div>
          <div className="flex gap-2">
            {!isStreaming ? (
              <Button
                onClick={startStreaming}
                className="bg-gradient-to-r from-neon-cyan to-electric-blue text-black hover:opacity-90"
                size="sm"
              >
                <Video className="w-4 h-4 mr-2" />
                Start Stream
              </Button>
            ) : (
              <Button
                onClick={stopStreaming}
                variant="destructive"
                size="sm"
              >
                <MonitorX className="w-4 h-4 mr-2" />
                Stop Stream
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Local Video */}
          {isStreaming && (
            <Card className="relative overflow-hidden bg-card/50 border-border/50">
              <CardContent className="p-0">
                <div className="relative aspect-video bg-muted">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="bg-background/80 text-foreground">
                      You
                    </Badge>
                  </div>
                  <div className="absolute bottom-2 right-2 flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleVideo}
                      className={`p-2 ${!streamEnabled.video ? 'text-red-500' : 'text-foreground'}`}
                    >
                      {streamEnabled.video ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleAudio}
                      className={`p-2 ${!streamEnabled.audio ? 'text-red-500' : 'text-foreground'}`}
                    >
                      {streamEnabled.audio ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Remote Videos */}
          {participants.map((participant) => (
            <Card key={participant.user_id} className="relative overflow-hidden bg-card/50 border-border/50">
              <CardContent className="p-0">
                <div className="relative aspect-video bg-muted">
                  {participant.stream ? (
                    <video
                      autoPlay
                      playsInline
                      ref={(video) => {
                        if (video && participant.stream) {
                          video.srcObject = participant.stream;
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Avatar className="w-16 h-16 mx-auto mb-2">
                          <AvatarFallback className="text-lg">
                            {participant.username?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-sm text-muted-foreground">Connecting...</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="bg-background/80 text-foreground">
                      {participant.username || 'Unknown'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {!isStreaming && participants.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Monitor className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h4 className="text-lg font-semibold text-foreground mb-2">No Active Streams</h4>
              <p className="text-muted-foreground mb-4">
                Start streaming to see and hear other producers in real-time
              </p>
              <Button
                onClick={startStreaming}
                className="bg-gradient-to-r from-neon-cyan to-electric-blue text-black hover:opacity-90"
              >
                <Video className="w-4 h-4 mr-2" />
                Start Your Stream
              </Button>
            </div>
          </div>
        )}

        {/* Permission Notice */}
        {!canEdit && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              <strong>View Only:</strong> You can see other producers' streams but your editing permissions are limited.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};