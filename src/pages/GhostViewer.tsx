import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { GhostUI } from '@/components/cookmode/GhostUI';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Radio, ArrowLeft, ExternalLink } from 'lucide-react';
import { MetaTags } from '@/components/MetaTags';

const GhostViewer = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [hlsStreamUrl, setHlsStreamUrl] = useState('');

  useEffect(() => {
    if (sessionId) {
      // Auto-generate HLS stream URL based on session ID
      // Host needs to configure OBS to stream to this endpoint
      setHlsStreamUrl(`https://stream.beatpackz.com/live/${sessionId}.m3u8`);
    }
  }, [sessionId]);

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
                
                <div className="flex items-center gap-2">
                  <Radio className="w-5 h-5 text-neon-cyan animate-pulse" />
                  <h1 className="text-xl font-bold bg-gradient-to-r from-neon-cyan to-electric-blue bg-clip-text text-transparent">
                    Ghost UI Viewer
                  </h1>
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
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <GhostUI 
              sessionId={sessionId} 
              hlsStreamUrl={hlsStreamUrl}
            />
          </div>
        </main>
      </div>
    </>
  );
};

export default GhostViewer;
