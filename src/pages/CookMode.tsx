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
import { useAudioBroadcast } from '@/hooks/useAudioBroadcast';
import { sessionLoopEngine } from '@/lib/sessionLoopEngine';
// import { useWebRTCAudioStream } from '@/hooks/useWebRTCAudioStream'; // Disabled until HLS server deployed
import AudioStreamIndicator from '@/components/cookmode/AudioStreamIndicator';
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
import { useMuxAudioStream } from '@/hooks/useMuxAudioStream';

const CookMode = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [isHost, setIsHost] = useState(false);
  const [activeView, setActiveView] = useState<'timeline' | 'mixer'>('timeline');
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [minBars, setMinBars] = useState(8);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [pianoRollState, setPianoRollState] = useState<{ isOpen: boolean; trackId?: string; trackName?: string; mode?: 'midi' | 'sample'; sampleUrl?: string; }>({ isOpen: false });
  const [sessionConfig, setSessionConfig] = useState({
    bpm: 120,
    key: 'C',
    name: ''
  });
  const [isStreaming, setIsStreaming] = useState(false);
  
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
  
  const { permissions, loading: permissionsLoading } = useCollaborationPermissions(sessionId);
  const { midiDevices, setActiveTrack, tracks: audioTracks, createTrack, loadSample, setTrackTrim, masterDestination } = useCookModeAudio(permissions?.canEdit || false);

  const [mixedAudioStream, setMixedAudioStream] = React.useState<MediaStream | null>(null);

  React.useEffect(() => {
    let intervalId: number | undefined;
    if (permissions?.canEdit && isPlaying) {
      const tryGet = () => {
        const stream = sessionLoopEngine.getMixedAudioStream();
        if (stream) {
          console.log('[CookMode] Mixed audio stream ready');
          setMixedAudioStream(stream);
          if (intervalId) {
            window.clearInterval(intervalId);
            intervalId = undefined;
          }
        } else {
          console.log('[CookMode] Mixed audio stream not ready yet, retrying...');
        }
      };
      tryGet();
      if (!sessionLoopEngine.getMixedAudioStream()) {
        intervalId = window.setInterval(tryGet, 300);
      }
    } else {
      setMixedAudioStream(null);
    }
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [permissions?.canEdit, isPlaying]);

  useMuxAudioStream({
    mediaStream: isStreaming ? mixedAudioStream : null,
    wsUrl: isStreaming && mixedAudioStream ? 'ws://3.144.154.15:8080' : '',
    onError: (err) => {
      console.error('[CookMode] Mux audio stream error', err);
      toast.error("Streaming error: " + (err?.message || err));
    }
  });

  const audioLevel = 0;

  // TODO: Add complete CookMode render logic here
  return (
    <div className="min-h-screen bg-background">
      <MetaTags 
        title="Cook Mode - Collaborative Music Production"
        description="Real-time collaborative music production workspace"
      />
      
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Cook Mode</h1>
        
        {permissions?.canEdit && (
          <AudioStreamIndicator
            isHost={permissions.canEdit}
            isStreaming={isStreaming}
            audioLevel={audioLevel}
            onToggleStream={() => {
              setIsStreaming(s => {
                const next = !s;
                if (next) {
                  console.log('[CookMode] Go Live streaming started');
                  toast.success("Streaming to relay server started!");
                } else {
                  console.log('[CookMode] Streaming stopped');
                  toast("Streaming stopped");
                }
                return next;
              });
            }}
          />
        )}
        
        <p className="text-muted-foreground">Session ID: {sessionId}</p>
        <p className="text-sm">Connected: {isConnected ? 'Yes' : 'No'}</p>
        <p className="text-sm">Can Edit: {permissions?.canEdit ? 'Yes' : 'No'}</p>
      </div>
    </div>
  )
};

export default CookMode;