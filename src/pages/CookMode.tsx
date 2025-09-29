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
import { VideoStreamingPanel } from '@/components/cookmode/VideoStreamingPanel';
import { SessionParticipants } from '@/components/cookmode/SessionParticipants';
import { SessionControls } from '@/components/cookmode/SessionControls';
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
  Video,
  MessageSquare,
  MessageCircle,
  Gamepad2,
  FileAudio
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { InviteProducerButton } from '@/components/cookmode/InviteProducerButton';
import { useWebRTCStreaming } from '@/hooks/useWebRTCStreaming';

const CookMode: React.FC = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Core session data and state
  const sessionData = useCookModeSession(sessionId);
  const { 
    session, 
    tracks, 
    participants, 
    addTrack, 
    removeTrack, 
    updateTrack, 
    addEmptyTrack,
    trimTrack
  } = sessionData;

  // Audio engine and state
  const audioData = useCookModeAudio();
  
  // Realtime collaboration
  const realtimeData = useSessionRealtime(sessionId);
  const { participants: realtimeParticipants, playbackState } = realtimeData;

  // Permissions system
  const permissionsData = useCollaborationPermissions(sessionId);
  const { permissions, loading: permissionsLoading } = permissionsData;

  // State management
  const [activeView, setActiveView] = useState<'timeline' | 'mixer'>('timeline');
  const [activeSidebarTab, setActiveSidebarTab] = useState<'participants' | 'chat' | 'video'>('participants');
  const [minBars, setMinBars] = useState(8);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [midiControllers, setMidiControllers] = useState<any[]>([]);

  // Mock functions for missing functionality
  const handleTogglePlayback = () => setIsPlaying(!isPlaying);
  const handleSeekTo = (time: number) => setCurrentTime(time);
  const connectController = () => console.log('Connect MIDI controller');

  // Loading states
  const sessionLoading = !session;
  const sessionError = null;
  const isLiveSession = realtimeParticipants.length > 0;
  const currentUser = { id: 'current-user-id' }; // Mock user

  // Re-fetch participants when they change
  const fetchParticipants = async () => {
    queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
  };

  // Save session mutation
  const saveSessionMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error('No session ID');
      
      const { data, error } = await supabase
        .from('cook_mode_sessions')
        .update({ 
          updated_at: new Date().toISOString(),
          // Add any other fields that need to be saved
        })
        .eq('id', sessionId);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Session Saved",
        description: "Your session has been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: `Failed to save session: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Session settings update
  const updateSessionSettings = async ({ bpm, key }: { bpm?: number; key?: string }) => {
    if (!sessionId || !permissions.canEdit) return;
    
    try {
      const updates: any = {};
      if (bpm !== undefined) updates.target_bpm = bpm;
      if (key !== undefined) updates.target_genre = key;
      
      const { error } = await supabase
        .from('cook_mode_sessions')
        .update(updates)
        .eq('id', sessionId);

      if (error) throw error;
      
      // Invalidate queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      
    } catch (error) {
      console.error('Failed to update session settings:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update session settings",
        variant: "destructive",
      });
    }
  };

  const shareSessionLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link Copied",
      description: "Session link copied to clipboard",
    });
  };

  // Loading states
  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <p className="text-lg text-destructive mb-4">Failed to load session</p>
          <Button onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }


  // Main Cook Mode Interface
  return (
    <div className="min-h-screen bg-background overflow-hidden flex">
      <MetaTags 
        title={`Cook Mode: ${session.name} | BeatPackz`}
        description="Live beat creation session in progress"
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
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
                    <LiveSessionIndicator 
                      participantCount={realtimeParticipants.length || participants.length} 
                      isConnected={realtimeData.isConnected}
                      canEdit={permissions.canEdit}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Show MIDI Controllers if user can edit */}
              {permissions.canEdit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={connectController}
                    className="border-border/50 hover:border-neon-cyan/50"
                  >
                    <Gamepad2 className="w-4 h-4 mr-2" />
                    MIDI
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border/50 hover:border-neon-cyan/50"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <div className="p-3">
                        <h4 className="font-medium mb-2">MIDI Controllers</h4>
                        {midiControllers.length > 0 ? (
                          <>
                            {midiControllers.map((controller, index) => (
                              <div key={index} className="flex items-center justify-between py-1">
                                <span className="text-sm">{controller.name}</span>
                                <div className={`w-2 h-2 rounded-full ${controller.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="text-xs text-muted-foreground">No MIDI controllers detected</div>
                        )}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={shareSessionLink}
                className="border-border/50 hover:border-neon-cyan/50"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share Link
              </Button>
              
              {permissions.canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border/50 hover:border-neon-cyan/50"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Invite
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <InviteProducerButton 
                      sessionId={sessionId} 
                    />
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

        {/* DAW Interface */}
        <div className="flex-1 flex flex-col">
          {/* Transport Controls - only show if user can edit */}
          {permissions.canEdit && (
            <SessionControls
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
            />
          )}

          <Separator className="border-border/50" />

          <div className="flex-1 overflow-hidden">
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
              onTrimTrack={permissions.canEdit ? trimTrack : undefined}
              activeView={activeView}
              onViewChange={setActiveView}
              readOnly={!permissions.canEdit}
            />
          </div>
        </div>
      </div>

      {/* Right Sidebar - Full Height */}
      <div className="w-80 border-l border-border/50 bg-card/20 backdrop-blur-sm flex flex-col h-full">
        {/* Sidebar Tabs */}
        <Tabs value={activeSidebarTab} onValueChange={(value) => setActiveSidebarTab(value as 'participants' | 'chat' | 'video')}>
          <div className="p-4 border-b border-border/50">
            <TabsList className="grid w-full grid-cols-3 bg-background/50">
              <TabsTrigger 
                value="participants" 
                className="flex items-center gap-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Users className="w-3 h-3" />
                Participants
              </TabsTrigger>
              <TabsTrigger 
                value="chat" 
                className="flex items-center gap-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <MessageCircle className="w-3 h-3" />
                Chat
              </TabsTrigger>
              <TabsTrigger 
                value="video" 
                className="flex items-center gap-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Video className="w-3 h-3" />
                Video
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="participants" className="h-full m-0">
              <div className="p-4">
                <SessionParticipants participants={participants} sessionId={sessionId!} />
              </div>
            </TabsContent>
            
            <TabsContent value="chat" className="h-full m-0">
              <CookModeChat sessionId={sessionId!} />
            </TabsContent>
            
            <TabsContent value="video" className="h-full m-0">
              <VideoStreamingPanel 
                sessionId={sessionId!} 
                canEdit={permissions.canEdit}
                currentUserId={currentUser?.id}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default CookMode;