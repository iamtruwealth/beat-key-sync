import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { GhostUI } from '@/components/cookmode/GhostUI';
import { CookModeDAW } from '@/components/cookmode/CookModeDAW';
import { useCookModeSession } from '@/hooks/useCookModeSession';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Radio, ArrowLeft, ExternalLink, Headphones } from 'lucide-react';
import { MetaTags } from '@/components/MetaTags';

const GhostViewer = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [activeView, setActiveView] = useState<'timeline' | 'mixer'>('timeline');
  
  const {
    session,
    tracks = [],
    isPlaying = false,
    currentTime = 0,
  } = useCookModeSession(sessionId) || {};

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
        title="Ghost UI Viewer - BeatPackz"
        description="Watch a live Cook Mode session with synchronized visuals and audio"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/80">
        {/* Header */}
        <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.history.back()}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                
                <div className="flex items-center gap-3">
                  <Radio className="w-5 h-5 text-neon-cyan animate-pulse" />
                  <h1 className="text-xl font-bold bg-gradient-to-r from-neon-cyan to-electric-blue bg-clip-text text-transparent">
                    Ghost UI Viewer
                  </h1>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-neon-cyan/10 border border-neon-cyan/30">
                    <Headphones className="w-4 h-4 text-neon-cyan" />
                    <span className="text-xs font-medium text-neon-cyan">Live Audio</span>
                  </div>
                </div>
              </div>

              <a
                href={`/cook-mode/${sessionId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Open Full Session
                </Button>
              </a>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="h-[calc(100vh-80px)]">
          <GhostUI sessionId={sessionId || ''}>
            {tracks.length > 0 ? (
              <CookModeDAW
                tracks={tracks}
                isPlaying={isPlaying}
                currentTime={currentTime}
                bpm={session?.target_bpm || 120}
                metronomeEnabled={false}
                minBars={8}
                onAddTrack={async () => {}}
                onRemoveTrack={async () => {}}
                onUpdateTrack={() => {}}
                onTogglePlayback={() => {}}
                onSeek={() => {}}
                onTrimTrack={() => {}}
                activeView={activeView}
                onViewChange={setActiveView}
                readOnly={true}
              />
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
        </main>
      </div>
    </>
  );
};

export default GhostViewer;
