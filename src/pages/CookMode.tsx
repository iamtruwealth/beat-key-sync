import * as Tone from 'tone';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MetaTags } from '@/components/MetaTags';
import { GlassMorphismSection } from '@/components/futuristic/GlassMorphismSection';
import { useCookModeSession } from '@/hooks/useCookModeSession';
import { useCookModeAudio } from '@/hooks/useCookModeAudio';
import { useSessionRealtime } from '@/hooks/useSessionRealtime';
import { useCollaborationPermissions } from '@/hooks/useCollaborationPermissions';
import { CookModeDAW } from '@/components/cookmode/CookModeDAW';
import { LiveSessionIndicator } from '@/components/cookmode/LiveSessionIndicator';
import { AccessLevelNotification } from '@/components/cookmode/AccessLevelNotification';
import { CookModeChat } from '@/components/cookmode/CookModeChat';
import { SessionParticipants } from '@/components/cookmode/SessionParticipants';
import { SessionControls } from '@/components/cookmode/SessionControls';
import { GhostUI } from '@/components/cookmode/GhostUI';
import { useGhostUIBroadcast } from '@/hooks/useGhostUIBroadcast';
import { useWebRTCAudioStream } from '@/hooks/useWebRTCAudioStream';
import { AudioStreamIndicator } from '@/components/cookmode/AudioStreamIndicator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CookModeAudioControls } from '@/components/cookmode/CookModeAudioControls';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Play, 
  Pause, 
  Square, 
  SkipBack, 
  SkipForward,
  Volume2,
  Clock,
  Activity,
  Settings,
  RotateCcw,
  Timer,
  Undo,
  Users, 
  Music, 
  Zap, 
  Share2,
  Save,
  Download,
  Layers,
  LayoutDashboard,
  ChevronDown,
  Piano,
  MessageSquare,
  UserPlus,
  Radio
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const CookMode = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [isHost, setIsHost] = useState(false);
  const [activeView, setActiveView] = useState<'timeline' | 'mixer'>('timeline');
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [minBars, setMinBars] = useState(8);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
    trimTrack,
    updateSessionSettings,
    saveSession,
    addEmptyTrack
  } = useCookModeSession(sessionId);
  // Check collaboration permissions
  const { permissions, loading: permissionsLoading } = useCollaborationPermissions(sessionId);
  
  const { midiDevices, setActiveTrack, tracks: audioTracks, createTrack, loadSample, setTrackTrim, masterDestination } = useCookModeAudio(permissions?.canEdit || false);

  // Ghost UI broadcast for hosts (always enabled)
  const { broadcastState, broadcastClipTrigger, broadcastPadPress } = useGhostUIBroadcast({
    sessionId: sessionId || '',
    isHost: permissions?.canEdit || false,
    enabled: true,
  });

  // WebRTC Audio Stream (automatic, built-in)
  const { isStreaming, audioLevel, startStreaming, stopStreaming } = useWebRTCAudioStream({
    sessionId: sessionId || '',
    isHost: permissions?.canEdit || false,
    enabled: true,
  });

  // Auto-start streaming when master destination is available
  React.useEffect(() => {
    if (permissions?.canEdit && masterDestination && !isStreaming) {
      startStreaming(masterDestination as AudioDestinationNode);
    }
  }, [permissions?.canEdit, masterDestination, isStreaming, startStreaming]);

  // Real-time collaboration
  const { 
    participants: realtimeParticipants, 
    playbackState, 
    broadcastPlaybackToggle, 
    broadcastPlaybackSeek,
    isConnected: realtimeConnected 
  } = useSessionRealtime(sessionId);

  // Check authentication status first (listener first, then fetch) with fallback timeout
  useEffect(() => {
    let mounted = true;
    // Fallback in case SDK hangs; prevent infinite spinner
    const timeoutId = window.setTimeout(() => {
      if (mounted) setAuthLoading(false);
    }, 2000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setIsAuthenticated(!!session);
      setAuthLoading(false);
    });

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setIsAuthenticated(!!session);
        setAuthLoading(false);
        window.clearTimeout(timeoutId);
      })
      .catch((error) => {
        console.error('Auth check error:', error);
        if (mounted) setIsAuthenticated(false);
        if (mounted) setAuthLoading(false);
        window.clearTimeout(timeoutId);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.clearTimeout(timeoutId);
    };
  }, []);

  // Get current user for video streaming
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, [isAuthenticated]);


  // Join session when we have sessionId and are authenticated
  useEffect(() => {
    if (sessionId && !session && isAuthenticated) {
      console.log('Joining session:', sessionId);
      joinSession(sessionId);
    }
  }, [sessionId, session, joinSession, isAuthenticated]);

  // Auto-enable audio context for live viewers (with safe fallbacks)
  useEffect(() => {
    const cleanupFns: Array<() => void> = [];

    const tryEnable = async () => {
      await Tone.start();
      const ctx = Tone.getContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      console.log('🔊 Audio auto-enabled for live viewer');
    };

    const attachFallback = () => {
      const fallbackEnable = async () => {
        try {
          await Tone.start();
          const ctx = Tone.getContext();
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
          console.log('🔊 Audio enabled via fallback interaction');
        } catch (err) {
          console.warn('Fallback audio enable failed:', err);
        }
      };

      ['click', 'keydown', 'touchstart'].forEach((evt) => {
        const handler = () => fallbackEnable();
        document.addEventListener(evt, handler, { once: true });
        cleanupFns.push(() => document.removeEventListener(evt, handler));
      });
    };

    tryEnable().catch((e) => {
      console.warn('Auto audio enable failed, attaching fallbacks:', e);
      attachFallback();
    });

    return () => {
      cleanupFns.forEach((fn) => fn());
    };
  }, []);

  const handleCreateSession = async () => {
    console.log('[CookMode] handleCreateSession clicked', sessionConfig);
    if (!sessionConfig.name || !sessionConfig.bpm) {
      toast.error("Please fill in all session details");
      return;
    }

    try {
      const newSessionId = await createSession({
        name: sessionConfig.name,
        bpm: parseInt(sessionConfig.bpm.toString()),
        key: sessionConfig.key,
        workspace_type: 'live_session'
      });
      console.log('[CookMode] Session created with id', newSessionId);
      
      setIsHost(true);
      navigate(`/cook-mode/${newSessionId}`);
      toast.success("Cook Mode session created! Share the link to invite collaborators.");
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error("Failed to create session");
    }
  };

  const handleSaveSession = async (publishImmediately = false) => {
    if (!session) return;
    
    try {
      await saveSession(publishImmediately);
      if (publishImmediately) {
        toast.success("Session saved and published! Converting to Beat Pack...");
        // Navigate to split sheet creation
        navigate(`/collaborate/projects/${session.id}/finalize`);
      } else {
        toast.success("Session saved successfully! You can continue working or publish later.");
      }
    } catch (error) {
      console.error('Error saving session:', error);
      toast.error("Failed to save session");
    }
  };

  const shareSessionLink = async () => {
    try {
      // Enable public access for this session
      const { error } = await supabase.rpc('enable_session_sharing', {
        session_id: sessionId
      });

      if (error) {
        console.error('Error enabling session sharing:', error);
      }

      // Share the Ghost UI viewer link instead of full cook-mode link
      const link = `${window.location.origin}/ghost/${sessionId}`;
      await navigator.clipboard.writeText(link);
      toast.success("Ghost UI viewer link copied! Viewers will see synchronized visuals and hear your audio stream.");
    } catch (error) {
      console.error('Error sharing session:', error);
      toast.error("Failed to share session link");
    }
  };

  // Wrap playback controls to broadcast to other users
  const handleTogglePlayback = () => {
    const next = !isPlaying;
    console.log('[CookMode] togglePlayback', { from: isPlaying, to: next });
    togglePlayback();
    if (broadcastPlaybackToggle) {
      broadcastPlaybackToggle(next);
    }
  };

  const handleSeekTo = (seconds: number) => {
    console.log('[CookMode] seekTo', seconds);
    seekTo(seconds);
    if (broadcastPlaybackSeek) {
      broadcastPlaybackSeek(seconds);
    }
  };

  // Hard stop - kills ALL audio immediately
  const handleHardStop = () => {
    console.log('🛑 HARD STOP - Killing all audio');
    
    try {
      // Stop and clear Tone.js Transport
      Tone.Transport.stop();
      Tone.Transport.cancel();
      Tone.Transport.position = 0;
      
      // Stop all HTML audio elements
      document.querySelectorAll('audio').forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
      });
      
      // Stop all media streams
      document.querySelectorAll('video').forEach(video => {
        video.pause();
        video.currentTime = 0;
        video.src = '';
      });
      
      // Reset playback state
      if (isPlaying) {
        togglePlayback();
      }
      seekTo(0);
      
      console.log('✅ Hard stop complete');
    } catch (error) {
      console.error('❌ Error during hard stop:', error);
    }
  };

  React.useEffect(() => {
    console.log('[CookMode] isPlaying changed', isPlaying);
  }, [isPlaying]);

  // Periodically broadcast Ghost UI state while playing
  React.useEffect(() => {
    if (!permissions.canEdit || !isPlaying || !session) return;

    const intervalId = setInterval(() => {
      broadcastState({
        playheadPosition: currentTime,
        isPlaying: true,
        bpm: session.target_bpm || 120,
        timestamp: Date.now(),
        loopRegion: minBars ? {
          start: 0,
          end: minBars * 4, // Convert bars to beats (4 beats per bar)
          enabled: true,
        } : undefined,
      });
    }, 200); // Broadcast every 200ms while playing

    return () => clearInterval(intervalId);
  }, [isPlaying, currentTime, permissions.canEdit, session, minBars, broadcastState]);

  // Session Creation Screen
  if (!sessionId) {
    // Redirect to auth if not authenticated for session creation
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
      return null;
    }

    if (authLoading) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      );
    }
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

  // Loading state - show when we have sessionId but no session data, still checking auth, or still checking permissions
  if (sessionId && ((authLoading || (!session || !isConnected)) || permissionsLoading)) {
    const getLoadingMessage = () => {
      if (authLoading) return 'Checking authentication...';
      if (permissionsLoading) return 'Checking permissions...';
      if (!session) return 'Loading session data...';
      if (!isConnected) return 'Connecting to realtime session...';
      return 'Connecting to Cook Mode session...';
    };

    console.log('🔄 Loading state:', {
      authLoading,
      hasSession: !!session,
      isConnected,
      permissionsLoading,
      sessionId
    });

    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {getLoadingMessage()}
          </p>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 text-xs text-muted-foreground opacity-50">
              <div>Auth: {authLoading ? 'loading' : 'ready'}</div>
              <div>Session: {session ? 'loaded' : 'missing'}</div>
              <div>Connected: {isConnected ? 'yes' : 'no'}</div>
              <div>Permissions: {permissionsLoading ? 'loading' : 'ready'}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Handle unauthenticated users accessing shared sessions
  if (sessionId && !authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold mb-4">Sign In Required</h1>
          <p className="text-muted-foreground mb-6">
            You need to sign in to join this Cook Mode session.
          </p>
          <Button onClick={() => navigate('/auth')} className="w-full">
            Sign In to Join Session
          </Button>
        </div>
      </div>
    );
  }

  // Check if user has permission to view this session
  if (sessionId && !permissionsLoading && !permissions.canView) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Session Not Available</h1>
          <p className="text-muted-foreground mb-4">This Cook Mode session is not publicly accessible.</p>
          <p className="text-sm text-muted-foreground">Ask the session owner to share a valid link or invite you as a collaborator.</p>
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
                <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                  {session.name}
                  {!permissions.canEdit && permissions.userRole === 'viewer' && (
                    <Badge variant="outline" className="text-xs border-orange-400 text-orange-400">
                      View Only
                    </Badge>
                  )}
                </h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{session.target_bpm} BPM</span>
                  <span>Key: {session.target_genre}</span>
                  <LiveSessionIndicator 
                    participantCount={realtimeParticipants.length || participants.length} 
                    isConnected={realtimeConnected} 
                    canEdit={permissions.canEdit}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Request Edit Access for viewers */}
            {!permissions.canEdit && permissions.userRole === 'viewer' && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;

                    // Add user as collaboration member with invited status
                    const { error } = await supabase
                      .from('collaboration_members')
                      .insert({
                        collaboration_id: sessionId,
                        user_id: user.id,
                        role: 'collaborator',
                        status: 'invited',
                        royalty_percentage: 0
                      });

                    if (error && !error.message.includes('duplicate')) throw error;

                    // Create notification for session owner
                    const { data: session } = await supabase
                      .from('collaboration_projects')
                      .select('name, created_by')
                      .eq('id', sessionId)
                      .single();

                    const { data: userProfile } = await supabase
                      .from('profiles')
                      .select('producer_name')
                      .eq('id', user.id)
                      .single();

                    await supabase
                      .from('notifications')
                      .insert({
                        user_id: session?.created_by,
                        type: 'collaboration_request',
                        title: 'Edit Access Request',
                        message: `${userProfile?.producer_name || 'A user'} is requesting edit access to "${session?.name || 'Cook Mode Session'}"`,
                        item_id: sessionId,
                        actor_id: user.id
                      });

                    toast.success("Your edit access request has been sent to the session owner");
                  } catch (error) {
                    console.error('Error requesting edit access:', error);
                    toast.error("Failed to request edit access");
                  }
                }}
                className="border-border/50 hover:border-orange-400"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Request Edit Access
              </Button>
            )}
            
            {permissions.canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border/50 hover:border-neon-cyan/50 flex items-center gap-2"
                  >
                    <Piano className="w-4 h-4" />
                    MIDI
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-background/95 backdrop-blur-sm border border-border/50">
                  <div className="p-2">
                    <div className="text-sm font-medium mb-2">MIDI Controllers</div>
                    {midiDevices && midiDevices.length > 0 ? (
                      <>
                        {midiDevices.map((device) => (
                          <DropdownMenuItem key={device.id} className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${device.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className="text-sm">{device.name}</span>
                          </DropdownMenuItem>
                        ))}
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground">No MIDI controllers detected</div>
                    )}
                  </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
            
            <AudioStreamIndicator
              isHost={permissions.canEdit}
              isStreaming={isStreaming}
              audioLevel={audioLevel}
              onToggleStream={permissions.canEdit ? (isStreaming ? stopStreaming : () => startStreaming(masterDestination as AudioDestinationNode)) : undefined}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={shareSessionLink}
              className="border-border/50 hover:border-neon-cyan/50"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Ghost UI Link
            </Button>
            
            {permissions.canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border/50 hover:border-electric-blue/50 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Session
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem 
                    onClick={() => handleSaveSession(false)}
                    className="flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Only
                    <span className="text-xs text-muted-foreground ml-auto">Keep working</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleSaveSession(true)}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Save & Publish
                    <span className="text-xs text-muted-foreground ml-auto">Finalize project</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        
        {/* Access Level Notification */}
        <AccessLevelNotification 
          canEdit={permissions.canEdit} 
          userRole={permissions.userRole} 
        />
      </div>

      {/* Main Interface */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* DAW Area */}
        <div className="flex-1 flex flex-col">
          {/* Transport Controls - only show if user can edit */}
          {permissions.canEdit && (
            <SessionControls
              canEdit={permissions.canEdit}
              isPlaying={isPlaying}
              currentTime={currentTime}
              bpm={session.target_bpm || 120}
              sessionKey={session.target_genre}
              sessionId={sessionId}
              minBars={minBars}
              metronomeEnabled={metronomeEnabled}
              onTogglePlayback={handleTogglePlayback}
              onSeek={handleSeekTo}
              onToggleMetronome={() => setMetronomeEnabled(!metronomeEnabled)}
              onUpdateBpm={(bpm) => updateSessionSettings({ bpm })}
              onUpdateKey={(key) => updateSessionSettings({ key })}
              onUpdateMinBars={(bars) => {
                console.log('Updating minBars to:', bars);
                setMinBars(bars);
              }}
              onCreateEmptyTrack={async (name) => { await addEmptyTrack(name); }}
              onAddTrack={addTrack}
              onHardStop={handleHardStop}
            />
          )}

          <Separator className="border-border/50" />

          <div className="flex-1 overflow-hidden">
            {/* Show full DAW UI for everyone, but read-only for viewers */}
            {!permissions.canEdit ? (
              <GhostUI sessionId={sessionId || ''}>
                <CookModeDAW
                  tracks={tracks}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  bpm={session.target_bpm || 120}
                  metronomeEnabled={metronomeEnabled}
                  minBars={minBars}
                  onAddTrack={undefined}
                  onRemoveTrack={undefined}
                  onUpdateTrack={undefined}
                  onTogglePlayback={undefined}
                  onSeek={undefined}
                  onTrimTrack={undefined}
                  activeView={activeView}
                  onViewChange={setActiveView}
                  readOnly={true}
                />
              </GhostUI>
            ) : (
              <CookModeDAW
                tracks={tracks}
                isPlaying={isPlaying}
                currentTime={currentTime}
                bpm={session.target_bpm || 120}
                metronomeEnabled={metronomeEnabled}
                minBars={minBars}
                onAddTrack={permissions.canEdit ? addTrack : undefined}
                onRemoveTrack={permissions.canEdit ? removeTrack : undefined}
                onUpdateTrack={permissions.canEdit ? updateTrack : undefined}
                onTogglePlayback={permissions.canEdit ? handleTogglePlayback : undefined}
                onSeek={permissions.canEdit ? handleSeekTo : undefined}
                onHardStop={permissions.canEdit ? handleHardStop : undefined}
                onTrimTrack={permissions.canEdit ? trimTrack : undefined}
                activeView={activeView}
                onViewChange={setActiveView}
                readOnly={!permissions.canEdit}
                setActiveTrack={setActiveTrack}
                createTrack={createTrack}
                loadSample={loadSample}
              />
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 border-l border-border/50 bg-card/20 backdrop-blur-sm flex flex-col h-full">
          {/* Video Toggle Header */}
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <h3 className="font-medium text-foreground">Collaboration</h3>
          </div>

          {/* Always visible participants section */}
          <div className="p-4 border-b border-border/50 flex-shrink-0">
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Participants ({participants.length})
            </h4>
            <SessionParticipants participants={participants} sessionId={sessionId!} showVideo={false} />
          </div>

          {/* Always visible chat section - takes remaining space */}
          <div className="flex-1 flex flex-col min-h-0">
            <Tabs defaultValue="chat" className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2 mx-4 mt-4">
                <TabsTrigger value="chat" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="audio" className="flex items-center gap-2">
                  <Piano className="w-4 h-4" />
                  Audio
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="chat" className="flex-1 overflow-hidden min-h-0 m-0">
                <div className="flex-1 overflow-hidden min-h-0 p-4 pt-2">
                  <CookModeChat sessionId={sessionId!} />
                </div>
              </TabsContent>
              
              <TabsContent value="audio" className="flex-1 overflow-hidden min-h-0 m-0">
                <div className="flex-1 overflow-auto p-4 pt-2 space-y-4">
                  {/* Info for guests */}
                  {!permissions.canEdit && (
                    <div className="p-3 bg-card/50 border border-border/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        You're receiving live audio from producers automatically. Adjust the volume in your browser's tab controls.
                      </p>
                    </div>
                  )}
                  
                  {/* Audio Controls for editors only */}
                  {permissions.canEdit && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2">Audio Controls</h4>
                      <CookModeAudioControls canEdit={permissions.canEdit} />
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookMode;