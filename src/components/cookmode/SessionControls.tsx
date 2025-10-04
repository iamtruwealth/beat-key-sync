import React, { useState, useEffect } from 'react';
import * as Tone from 'tone';
import { Button } from '@/components/ui/button';
import { useSessionRecordings } from '@/hooks/useSessionRecordings';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  Plus,
  Circle,
  Mic,
  Upload,
  FileAudio,
  Grid,
  ChevronDown
} from 'lucide-react';
import { undoManager } from '@/lib/UndoManager';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useCookModeAudio } from '@/hooks/useCookModeAudio';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface SessionControlsProps {
  isPlaying: boolean;
  currentTime: number;
  bpm: number;
  sessionKey?: string;
  isLooping?: boolean;
  metronomeEnabled?: boolean;
  sessionId?: string;
  minBars?: number;
  onTogglePlayback: () => void;
  onSeek: (time: number) => void;
  onToggleLoop?: () => void;
  onToggleMetronome?: () => void;
  onUpdateBpm?: (bpm: number) => void;
  onUpdateKey?: (key: string) => void;
  onUpdateMinBars?: (bars: number) => void;
  onCreateEmptyTrack?: (name: string) => Promise<void> | void;
  onAddTrack?: (file: File, trackName: string, stemType: string) => Promise<void>;
  onHardStop?: () => void;
  canEdit?: boolean;
}

export const SessionControls: React.FC<SessionControlsProps> = ({
  isPlaying,
  currentTime,
  bpm,
  sessionKey,
  isLooping = false,
  metronomeEnabled = false,
  sessionId,
  minBars = 8,
  onTogglePlayback,
  onSeek,
  onToggleLoop,
  onToggleMetronome,
  onUpdateBpm,
  onUpdateKey,
  onUpdateMinBars,
  onCreateEmptyTrack,
  onAddTrack,
  onHardStop,
  canEdit = true
}) => {
  const { createTrack, isRecording, startAudioRecording, stopAudioRecording, startRecording, stopRecording, tracks: audioTracks, loadSample, setActiveTrack, engine } = useCookModeAudio(canEdit);
  const { toast } = useToast();
  const { saveRecording } = useSessionRecordings(sessionId || '');
  const [masterVolume, setMasterVolume] = useState(75);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const [tempBpm, setTempBpm] = useState(bpm.toString());
  const [currentRecordingTrackId, setCurrentRecordingTrackId] = useState<string | null>(null);
  const [recordingMode, setRecordingMode] = useState<'audio' | 'midi' | null>(null);
  const [recordingEnabled, setRecordingEnabled] = useState(false); // Ready to record when play is pressed
  const lastStopClickRef = React.useRef<number>(0);

  // Calculate session duration
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSessionTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVolumeChange = (value: number[]) => {
    setMasterVolume(value[0]);
    console.log('Setting master volume to:', value[0]);
    // Apply master volume to all audio elements
    const audioElements = document.querySelectorAll('audio');
    console.log('Found audio elements:', audioElements.length);
    audioElements.forEach((audio, index) => {
      const newVolume = value[0] / 100;
      audio.volume = newVolume;
      console.log(`Set audio element ${index} volume to:`, newVolume);
    });
  };

  const handleBpmEdit = () => {
    setIsEditingBpm(true);
    setTempBpm(bpm.toString());
  };

  const handleBpmSave = () => {
    const newBpm = parseInt(tempBpm);
    if (newBpm >= 60 && newBpm <= 200 && onUpdateBpm) {
      onUpdateBpm(newBpm);
    }
    setIsEditingBpm(false);
  };

  const handleBpmCancel = () => {
    setTempBpm(bpm.toString());
    setIsEditingBpm(false);
  };

  const handleKeyChange = (key: string) => {
    if (onUpdateKey) {
      onUpdateKey(key);
    }
  };

  const keys = [
    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
    'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'
  ];

  return (
    <div className="bg-card/30 backdrop-blur-sm border-b border-border/50">
      <div className="flex items-center justify-between p-4">
        {/* Left Section - Transport Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
              onClick={() => onSeek(Math.max(0, currentTime - 10))}
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            
            <Button
              onClick={() => {
                console.log('🎵 Play button CLICKED');
                onTogglePlayback();
              }}
              className={`p-3 ${
                isPlaying 
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:opacity-90' 
                  : 'bg-gradient-to-r from-neon-cyan to-electric-blue text-black hover:opacity-90'
              }`}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
              onClick={() => onSeek(currentTime + 10)}
            >
              <SkipForward className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
              onClick={async () => {
                const now = Date.now();
                const timeSinceLastClick = now - lastStopClickRef.current;
                
                // Stop recording if active
                if (isRecording) {
                  if (recordingMode === 'audio') {
                    const result = await stopAudioRecording(sessionId);
                    if (result) {
                      await saveRecording(result.blob, result.metadata);
                    }
                  } else if (recordingMode === 'midi') {
                    stopRecording();
                  }
                  setRecordingEnabled(false);
                  setRecordingMode(null);
                }
                
                // Double-click detection (within 300ms)
                if (timeSinceLastClick < 300) {
                  console.log('🛑 HARD STOP - Killing all audio');
                  onHardStop?.();
                  toast({
                    title: "Hard Stop",
                    description: "All audio stopped",
                  });
                } else {
                  // Single click - normal stop
                  onSeek(0);
                  if (isPlaying) {
                    onTogglePlayback();
                  }
                }
                
                lastStopClickRef.current = now;
              }}
              title="Click to stop, double-click to hard stop all audio"
            >
              <Square className="w-4 h-4" />
            </Button>

            {/* Record Enable Button - prepares recording, actual recording starts when play is pressed */}
            <Button
              variant={recordingEnabled ? "destructive" : "ghost"}
              size="sm"
              className={`p-2 gap-1 transition-all duration-200 ${
                recordingEnabled 
                  ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.8)]' 
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
              title={recordingEnabled ? "Recording armed - press Play to start" : "Enable recording mode"}
              onClick={() => {
                if (recordingEnabled) {
                  // Disable recording mode
                  setRecordingEnabled(false);
                  setRecordingMode(null);
                  setCurrentRecordingTrackId(null);
                  toast({
                    title: "Recording Disabled",
                    description: "Recording mode turned off",
                  });
                } else {
                  // Enable recording mode - show options
                  const armedTrackIds = Array.from(document.querySelectorAll('[data-track-armed="true"]'))
                    .map(el => el.getAttribute('data-track-id'))
                    .filter(Boolean) as string[];
                  
                  if (armedTrackIds.length === 0) {
                    toast({
                      title: "No Track Armed",
                      description: "Please arm a track for recording first (click the circle button on a track)",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Enable audio recording mode
                  setRecordingEnabled(true);
                  setRecordingMode('audio');
                  toast({
                    title: "Recording Armed",
                    description: "Press Play to start recording",
                  });
                }
              }}
            >
              {recordingEnabled ? (
                <>
                  <Circle className="w-4 h-4 fill-current" />
                  <span className="text-xs font-bold">REC</span>
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4" />
                  <span className="text-xs">REC</span>
                </>
              )}
            </Button>
            
            {isRecording && (
              <Button
                variant="ghost"
                size="sm"
                className="p-2"
                onClick={async () => {
                  if (recordingMode === 'audio') {
                    try {
                      const result = await stopAudioRecording(sessionId);
                      if (result) {
                        await saveRecording(result.blob, result.metadata);
                      }
                      setCurrentRecordingTrackId(null);
                      toast({
                        title: "Recording Stopped",
                        description: "Audio recording saved",
                      });
                    } catch (error) {
                      console.error('Failed to stop audio recording:', error);
                    }
                  } else if (recordingMode === 'midi') {
                    stopRecording();
                  }
                  setRecordingMode(null);
                }}
                title="Stop Recording"
              >
                <Square className="w-4 h-4" />
              </Button>
            )}

            <Button
              variant={metronomeEnabled ? "default" : "ghost"}
              size="sm"
              className={`p-2 gap-1 ${metronomeEnabled ? 'bg-electric-blue text-black' : ''}`}
              onClick={onToggleMetronome}
              disabled={!onToggleMetronome}
              title="Toggle Metronome"
            >
              <Timer className="w-4 h-4" />
              <span className="text-xs">Click</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`p-2 transition-all duration-200 ${
                undoManager.canUndo() 
                  ? 'hover:bg-accent hover:text-accent-foreground text-foreground' 
                  : 'text-muted-foreground/50 cursor-not-allowed'
              }`}
              onClick={() => {
                console.log('🔄 Undo button clicked');
                if (undoManager.canUndo()) {
                  undoManager.undo();
                } else {
                  console.log('⚠️ No actions to undo');
                }
              }}
              disabled={!undoManager.canUndo()}
              title={`Undo last action (${undoManager.getStackSize()} actions available)`}
            >
              <Undo className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`p-2 transition-all duration-200 ${
                undoManager.canRedo() 
                  ? 'hover:bg-accent hover:text-accent-foreground text-foreground' 
                  : 'text-muted-foreground/50 cursor-not-allowed'
              }`}
              onClick={() => {
                console.log('🔄 Redo button clicked');
                if (undoManager.canRedo()) {
                  undoManager.redo();
                } else {
                  console.log('⚠️ No actions to redo');
                }
              }}
              disabled={!undoManager.canRedo()}
              title="Redo last undone action"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          <div className="h-6 w-px bg-border/50" />

          {/* Time Display */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-mono text-foreground">
              {formatTime(currentTime)}
            </span>
          </div>
        </div>

        {/* Center Section - BPM, Key and Status */}
        <div className="flex items-center gap-6">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-neon-cyan" />
                {isEditingBpm ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={tempBpm}
                      onChange={(e) => setTempBpm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleBpmSave();
                        if (e.key === 'Escape') handleBpmCancel();
                      }}
                      onBlur={handleBpmSave}
                      className="w-12 h-6 text-xs p-1 text-center"
                      autoFocus
                    />
                    <span className="text-xs text-muted-foreground">BPM</span>
                  </div>
                ) : (
                  <>
                    <span 
                      className="text-sm font-semibold text-foreground cursor-pointer hover:text-neon-cyan"
                      onClick={handleBpmEdit}
                      title="Click to edit BPM"
                    >
                      {bpm}
                    </span>
                    <span className="text-xs text-muted-foreground">BPM</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Min Bars Control */}
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-2">
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 text-orange-400" />
                <Select 
                  value={minBars.toString()} 
                  onValueChange={(value) => onUpdateMinBars?.(parseInt(value))}
                >
                  <SelectTrigger className="w-12 h-6 text-xs border-none bg-transparent p-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border">
                    {[4, 8, 16, 32, 64].map((bars) => (
                      <SelectItem key={bars} value={bars.toString()} className="text-xs">
                        {bars}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">Min Bars</span>
              </div>
            </CardContent>
          </Card>

          {sessionKey && (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-2">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-electric-blue" />
                  <Select value={sessionKey} onValueChange={handleKeyChange}>
                    <SelectTrigger className="w-14 h-6 text-xs border-none bg-transparent p-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border max-h-48 overflow-y-auto">
                      <div className="p-1 text-xs font-medium text-muted-foreground border-b border-border/50 mb-1">
                        Major Keys
                      </div>
                      {keys.slice(0, 12).map((key) => (
                        <SelectItem key={key} value={key} className="text-xs">
                          {key}
                        </SelectItem>
                      ))}
                      <div className="p-1 text-xs font-medium text-muted-foreground border-b border-border/50 mb-1 mt-2">
                        Minor Keys
                      </div>
                      {keys.slice(12).map((key) => (
                        <SelectItem key={key} value={key} className="text-xs">
                          {key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">Key</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Badge 
            variant="outline" 
            className={`${
              isRecording
                ? 'text-red-400 border-red-400/30 bg-red-400/10'
                : isPlaying 
                ? 'text-green-400 border-green-400/30 bg-green-400/10' 
                : 'text-muted-foreground border-border/50'
            }`}
          >
            {isRecording ? 'Recording' : isPlaying ? 'Playing' : 'Stopped'}
          </Badge>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Session Time:</span>
            <span className="font-mono text-foreground">
              {formatSessionTime(sessionDuration)}
            </span>
          </div>
        </div>

        {/* Right Section - Track Controls */}
        <div className="flex items-center gap-2">
          {/* File Upload for Testing */}
          <Button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'audio/*';
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  const trackName = file.name.replace(/\.[^/.]+$/, "");
                  try {
                    if (onAddTrack) {
                      await onAddTrack(file, trackName, 'other');
                    }
                    const engineTrackId = createTrack(trackName);
                    await loadSample(engineTrackId, file);
                    toast({
                      title: "Audio Ready",
                      description: `Added "${trackName}" - click the MIDI button on the track to activate it!`,
                    });
                  } catch (error) {
                    console.error('Failed to add/prepare audio file:', error);
                    toast({
                      title: "Add Failed",
                      description: "Could not prepare the audio for playback",
                      variant: "destructive",
                    });
                  }
                }
              };
              input.click();
            }}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <FileAudio className="w-4 h-4" />
            Add Audio
          </Button>

          <Button
            onClick={async () => {
              const trackName = `Track ${Date.now()}`;
              // Create track in audio engine for recording/MIDI
              createTrack(trackName);
              
              // Ask parent to add empty track to session timeline
              try {
                await onCreateEmptyTrack?.(trackName);
              } catch (error) {
                console.error('Failed to add empty track to session:', error);
              }
            }}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Track
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 pb-2">
        <div className="relative">
          <div className="h-1 bg-background/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-neon-cyan to-electric-blue transition-all duration-100"
              style={{ 
                width: `${Math.min((currentTime / 180) * 100, 100)}%` // Assuming 3-minute max for visual
              }}
            />
          </div>
          {/* Click to seek functionality could be added here */}
          <div 
            className="absolute top-0 h-1 w-full cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = x / rect.width;
              const newTime = percentage * 180; // 3 minutes max
              onSeek(newTime);
            }}
          />
        </div>
      </div>
    </div>
  );
};