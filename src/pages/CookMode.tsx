import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MetaTags } from '@/components/MetaTags';
import { GlassMorphismSection } from '@/components/futuristic/GlassMorphismSection';
import { useCookModeSession } from '@/hooks/useCookModeSession';
import { CookModeDAW } from '@/components/cookmode/CookModeDAW';
import { CookModeChat } from '@/components/cookmode/CookModeChat';
import { SessionParticipants } from '@/components/cookmode/SessionParticipants';
import { SessionControls } from '@/components/cookmode/SessionControls';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Square, 
  Users, 
  Music, 
  Zap, 
  Settings,
  Share2,
  Save,
  Download,
  Clock,
  Layers,
  LayoutDashboard
} from 'lucide-react';
import { toast } from 'sonner';

const CookMode = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [isHost, setIsHost] = useState(false);
  const [activeView, setActiveView] = useState<'timeline' | 'mixer'>('timeline');
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [sessionConfig, setSessionConfig] = useState({
    bpm: 120,
    key: 'C',
    name: ''
  });
  
  const {
    session,
    participants,
    tracks,
    isPlaying,
    currentTime,
    isConnected,
    createSession,
    joinSession,
    addTrack,
    removeTrack,
    togglePlayback,
    seekTo,
    updateTrack,
    updateSessionSettings,
    saveSession
  } = useCookModeSession(sessionId);

  useEffect(() => {
    if (sessionId && !session) {
      console.log('Joining session:', sessionId);
      joinSession(sessionId);
    }
  }, [sessionId, session, joinSession]);

  // Enable audio context on first user interaction
  useEffect(() => {
    const enableAudio = () => {
      // Create a dummy audio context to enable audio
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('Audio context enabled');
        });
      }
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('keydown', enableAudio);
    };

    document.addEventListener('click', enableAudio);
    document.addEventListener('keydown', enableAudio);

    return () => {
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('keydown', enableAudio);
    };
  }, []);

  const handleCreateSession = async () => {
    if (!sessionConfig.name || !sessionConfig.bpm) {
      toast.error('Please fill in all session details');
      return;
    }

    try {
      const newSessionId = await createSession({
        name: sessionConfig.name,
        bpm: parseInt(sessionConfig.bpm.toString()),
        key: sessionConfig.key,
        workspace_type: 'live_session'
      });
      
      setIsHost(true);
      navigate(`/cook-mode/${newSessionId}`);
      toast.success('Cook Mode session created! Share the link to invite collaborators.');
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('Failed to create session');
    }
  };

  const handleSaveAndPublish = async () => {
    if (!session) return;
    
    try {
      await saveSession();
      toast.success('Session saved! Converting to Beat Pack...');
      // Navigate to split sheet creation
      navigate(`/collaborate/projects/${session.id}/finalize`);
    } catch (error) {
      console.error('Error saving session:', error);
      toast.error('Failed to save session');
    }
  };

  const shareSessionLink = async () => {
    const link = `${window.location.origin}/cook-mode/${sessionId}`;
    await navigator.clipboard.writeText(link);
    toast.success('Session link copied to clipboard!');
  };

  // Session Creation Screen
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background p-6 relative overflow-hidden">
        <MetaTags 
          title="Cook Mode - Live Beat Creation | BeatPackz"
          description="Create beats together in real-time with our browser-based DAW collaboration tool"
        />
        
        {/* Futuristic background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-96 h-96 bg-neon-cyan/10 rounded-full blur-3xl -top-48 -left-48 animate-float" />
          <div className="absolute w-80 h-80 bg-electric-blue/10 rounded-full blur-3xl top-1/3 -right-40 animate-float" style={{ animationDelay: '2s' }} />
          <div className="absolute w-64 h-64 bg-neon-magenta/10 rounded-full blur-3xl bottom-0 left-1/3 animate-float" style={{ animationDelay: '4s' }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-neon-cyan/20 to-electric-blue/20 border border-neon-cyan/30">
                <Zap className="w-8 h-8 text-neon-cyan animate-pulse" />
              </div>
              <div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-neon-cyan via-electric-blue to-neon-magenta bg-clip-text text-transparent">
                  Cook Mode
                </h1>
                <p className="text-muted-foreground text-xl">
                  Live Beat Creation • Real-Time Collaboration
                </p>
              </div>
            </div>
          </div>

          <GlassMorphismSection variant="neon" className="max-w-2xl mx-auto">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-neon-cyan">
                  <Music className="w-5 h-5" />
                  Start Live Collab Session
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="sessionName">Session Name</Label>
                  <Input
                    id="sessionName"
                    placeholder="e.g., Late Night Vibes Session"
                    value={sessionConfig.name}
                    onChange={(e) => setSessionConfig(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-background/50 border-border/50 focus:border-neon-cyan/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bpm">BPM</Label>
                    <Input
                      id="bpm"
                      type="number"
                      min="60"
                      max="200"
                      value={sessionConfig.bpm}
                      onChange={(e) => setSessionConfig(prev => ({ ...prev, bpm: parseInt(e.target.value) }))}
                      className="bg-background/50 border-border/50 focus:border-neon-cyan/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="key">Key Signature</Label>
                    <Select 
                      value={sessionConfig.key} 
                      onValueChange={(value) => setSessionConfig(prev => ({ ...prev, key: value }))}
                    >
                      <SelectTrigger className="bg-background/50 border-border/50 focus:border-neon-cyan/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-48 overflow-y-auto">
                        <div className="p-1 text-xs font-medium text-muted-foreground border-b border-border/50 mb-1">
                          Major Keys
                        </div>
                        {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(key => (
                          <SelectItem key={key} value={key}>{key}</SelectItem>
                        ))}
                        <div className="p-1 text-xs font-medium text-muted-foreground border-b border-border/50 mb-1 mt-2">
                          Minor Keys
                        </div>
                        {['Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'].map(key => (
                          <SelectItem key={key} value={key}>{key}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={handleCreateSession}
                  className="w-full bg-gradient-to-r from-neon-cyan to-electric-blue text-black font-semibold hover:opacity-90 transition-opacity"
                  size="lg"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Enter Cook Mode
                </Button>

                <div className="text-center pt-4">
                  <p className="text-sm text-muted-foreground">
                    Create a live session to collaborate with other producers in real-time
                  </p>
                </div>
              </CardContent>
            </Card>
          </GlassMorphismSection>
        </div>
      </div>
    );
  }

  // Loading state - only show when we have a sessionId but no session data
  if (sessionId && (!session || !isConnected)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan mx-auto mb-4"></div>
          <p className="text-muted-foreground">Connecting to Cook Mode session...</p>
        </div>
      </div>
    );
  }

  // Main Cook Mode Interface
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <MetaTags 
        title={`Cook Mode: ${session.name} | BeatPackz`}
        description="Live beat creation session in progress"
      />

      {/* View Switcher - At Very Top Center of Page */}
      <div className="flex items-center justify-between p-4 border-b border-border/30 bg-card/20 backdrop-blur-sm">
        {/* Dashboard Button - Far Left */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 border-border/50 hover:bg-card/30"
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </Button>

        {/* View Switcher - Center */}
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

        {/* Empty space for balance */}
        <div className="w-24" />
      </div>

      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-neon-cyan/20 to-electric-blue/20 border border-neon-cyan/30">
                <Zap className="w-5 h-5 text-neon-cyan animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{session.name}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{session.target_bpm} BPM</span>
                  <span>Key: {session.target_genre}</span>
                  <Badge variant="outline" className="text-xs">
                    <Users className="w-3 h-3 mr-1" />
                    {participants.length} online
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={shareSessionLink}
              className="border-border/50 hover:border-neon-cyan/50"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Link
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveAndPublish}
              className="border-border/50 hover:border-electric-blue/50"
            >
              <Save className="w-4 h-4 mr-2" />
              Save & Publish
            </Button>
          </div>
        </div>
      </div>

      {/* Main Interface */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* DAW Area */}
        <div className="flex-1 flex flex-col">
          {/* Transport Controls */}
          <SessionControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            bpm={session.target_bpm || 120}
            sessionKey={session.target_genre}
            metronomeEnabled={metronomeEnabled}
            onTogglePlayback={togglePlayback}
            onSeek={seekTo}
            onToggleMetronome={() => setMetronomeEnabled(!metronomeEnabled)}
            onUpdateBpm={(bpm) => updateSessionSettings({ bpm })}
            onUpdateKey={(key) => updateSessionSettings({ key })}
          />

          <Separator className="border-border/50" />

          {/* DAW Interface */}
          <div className="flex-1 overflow-hidden">
            <CookModeDAW
              tracks={tracks}
              isPlaying={isPlaying}
              currentTime={currentTime}
              bpm={session.target_bpm || 120}
              metronomeEnabled={metronomeEnabled}
              onAddTrack={addTrack}
              onRemoveTrack={removeTrack}
              onUpdateTrack={updateTrack}
              onPlayPause={togglePlayback}
              onSeek={seekTo}
              externalActiveView={activeView}
              onActiveViewChange={(v) => setActiveView(v)}
            />
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 border-l border-border/50 bg-card/20 backdrop-blur-sm flex flex-col">
          {/* Participants */}
          <div className="p-4 border-b border-border/50">
            <SessionParticipants participants={participants} />
          </div>

          {/* Chat */}
          <div className="flex-1 overflow-hidden">
            <CookModeChat sessionId={sessionId!} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookMode;