import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { GhostUI } from '@/components/cookmode/GhostUI';
import { GhostCursor } from '@/components/cookmode/GhostCursor';
import { CookModeDAW } from '@/components/cookmode/CookModeDAW';
import { PianoRoll } from '@/components/cookmode/PianoRoll';
import { useCookModeSession } from '@/hooks/useCookModeSession';
import { useGhostUIReceiver } from '@/hooks/useGhostUIReceiver';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { LiveSessionIndicator } from '@/components/cookmode/LiveSessionIndicator';
import { SessionParticipants } from '@/components/cookmode/SessionParticipants';
import { CookModeChat } from '@/components/cookmode/CookModeChat';
import { Radio, ArrowLeft, ExternalLink, Headphones, Layers, Clock, Zap, Users } from 'lucide-react';
import { MetaTags } from '@/components/MetaTags';
import { TrackMode } from '@/types/pianoRoll';

const GhostViewer = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [activeView, setActiveView] = useState<'timeline' | 'mixer'>('timeline');

  const {
    session,
    participants = [],
    tracks = [],
    isConnected: sessionConnected,
    joinSession,
  } = useCookModeSession(sessionId) || {} as any;

  // Join session to load tracks from database
  useEffect(() => {
    if (sessionId && joinSession && !session) {
      console.log('[GhostViewer] Joining session to load tracks:', sessionId);
      joinSession(sessionId);
    }
  }, [sessionId, joinSession, session]);

  // Get synced UI state from Ghost UI broadcast
  const { ghostState, isConnected: ghostConnected } = useGhostUIReceiver({
    sessionId: sessionId || '',
    isViewer: true,
    enabled: !!sessionId,
  });

  // Follow host's view when broadcasted
  useEffect(() => {
    if (ghostState?.activeView && ghostState.activeView !== activeView) {
      setActiveView(ghostState.activeView);
    }
  }, [ghostState?.activeView]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/80 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-500">Invalid Session</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No session ID provided</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <MetaTags 
        title={`Ghost Viewer: ${session?.name || 'Live Session'} | BeatPackz`}
        description="Watch a live Cook Mode session with synchronized visuals and audio"
      />

      <div className="min-h-screen bg-background overflow-hidden">
        {/* Top View Switcher (mirrors Cook Mode) */}
        <div className="flex items-center justify-between p-4 border-b border-border/30 bg-card/20 backdrop-blur-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.history.back()}
            className="flex items-center gap-2 border-border/50 hover:bg-card/30"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          <Tabs value={activeView} onValueChange={(value) => setActiveView(value as 'timeline' | 'mixer')}>
            <TabsList className="bg-background/80 border border-border/30">
              <TabsTrigger 
                value="timeline" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Clock className="w-4 h-4" />
                Timeline
              </TabsTrigger>
              <TabsTrigger 
                value="mixer" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Layers className="w-4 h-4" />
                Mixer
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <a href={`/cook-mode/${sessionId}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Open Full Session
            </Button>
          </a>
        </div>

        {/* Header (mirrors Cook Mode) */}
        <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-neon-cyan/20 to-electric-blue/20 border border-neon-cyan/30">
                  <Zap className="w-5 h-5 text-neon-cyan animate-pulse" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                    {session?.name || 'Live Session'}
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{ghostState?.bpm || session?.target_bpm || 120} BPM</span>
                    <LiveSessionIndicator 
                      participantCount={participants?.length || 0}
                      isConnected={(sessionConnected ?? false) || (ghostConnected ?? false)}
                      canEdit={false}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-neon-cyan/10 border border-neon-cyan/30">
                <Headphones className="w-4 h-4 text-neon-cyan" />
                <span className="text-xs font-medium text-neon-cyan">Live Audio</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Interface (clone layout) */}
        <div className="flex h-[calc(100vh-80px)]">
          {/* DAW Area */}
          <div className="flex-1 overflow-hidden relative">
            {/* Ghost Cursor - shows host's mouse movements */}
            {ghostState?.mousePosition && (
              <GhostCursor
                x={ghostState.mousePosition.x}
                y={ghostState.mousePosition.y}
                isMoving={ghostState.mousePosition.isMoving}
              />
            )}

            <GhostUI sessionId={sessionId || ''}>
              {tracks.length > 0 ? (
                <>
                  <CookModeDAW
                    tracks={tracks}
                    isPlaying={!!ghostState?.isPlaying}
                    currentTime={ghostState?.playheadPosition || 0}
                    bpm={ghostState?.bpm || session?.target_bpm || 120}
                    metronomeEnabled={false}
                    minBars={8}
                    onAddTrack={undefined}
                    onRemoveTrack={undefined}
                    onUpdateTrack={undefined}
                    onTogglePlayback={undefined}
                    onSeek={undefined}
                    onTrimTrack={undefined}
                    onHardStop={undefined}
                    activeView={activeView}
                    onViewChange={setActiveView}
                    readOnly={true}
                  />

                  {/* Mirror Piano Roll when host opens it */}
                  {ghostState?.pianoRoll?.isOpen && ghostState.pianoRoll.trackId && (
                    <PianoRoll
                      isOpen={true}
                      onClose={() => {}} // Read-only, can't close
                      trackId={ghostState.pianoRoll.trackId}
                      trackName={ghostState.pianoRoll.trackName || 'Track'}
                      trackMode={(ghostState.pianoRoll.mode || 'sample') as TrackMode}
                      trackSampleUrl={ghostState.pianoRoll.sampleUrl}
                      sessionBpm={ghostState.bpm || 120}
                      sessionIsPlaying={!!ghostState.isPlaying}
                      sessionCurrentTime={ghostState.playheadPosition || 0}
                      onToggleSessionPlayback={() => {}} // Read-only
                      onSave={() => {}} // Read-only
                    />
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Card className="max-w-md">
                    <CardContent className="pt-6">
                      <div className="text-center space-y-2">
                        <Headphones className="w-12 h-12 mx-auto text-muted-foreground" />
                        <p className="text-lg font-medium">Waiting for session data...</p>
                        <p className="text-sm text-muted-foreground">
                          The host hasn't started the session yet or there are no tracks loaded.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </GhostUI>
          </div>

          {/* Right Sidebar */}
          <div className="w-80 border-l border-border/50 bg-card/20 backdrop-blur-sm flex flex-col h-full">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-medium text-foreground">Collaboration</h3>
            </div>

            <div className="p-4 border-b border-border/50 flex-shrink-0">
              <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Participants ({participants?.length || 0})
              </h4>
              <SessionParticipants participants={participants || []} sessionId={sessionId!} showVideo={false} />
            </div>

            <div className="flex-1 min-h-0">
              <CookModeChat sessionId={sessionId!} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GhostViewer;
