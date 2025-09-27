import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
  RotateCcw
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface SessionControlsProps {
  isPlaying: boolean;
  currentTime: number;
  bpm: number;
  sessionKey?: string;
  isLooping?: boolean;
  onTogglePlayback: () => void;
  onSeek: (time: number) => void;
  onToggleLoop?: () => void;
  onUpdateBpm?: (bpm: number) => void;
  onUpdateKey?: (key: string) => void;
}

export const SessionControls: React.FC<SessionControlsProps> = ({
  isPlaying,
  currentTime,
  bpm,
  sessionKey,
  isLooping = false,
  onTogglePlayback,
  onSeek,
  onToggleLoop,
  onUpdateBpm,
  onUpdateKey
}) => {
  const [masterVolume, setMasterVolume] = useState(75);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const [tempBpm, setTempBpm] = useState(bpm.toString());

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
              onClick={onTogglePlayback}
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
              onClick={() => {
                onSeek(0);
                // Stop playback if playing
                if (isPlaying) {
                  onTogglePlayback();
                }
              }}
            >
              <Square className="w-4 h-4" />
            </Button>

            <Button
              variant={isLooping ? "default" : "ghost"}
              size="sm"
              className={`p-2 ${isLooping ? 'bg-neon-cyan text-black' : ''}`}
              onClick={onToggleLoop}
              disabled={!onToggleLoop}
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
              isPlaying 
                ? 'text-green-400 border-green-400/30 bg-green-400/10' 
                : 'text-muted-foreground border-border/50'
            }`}
          >
            {isPlaying ? 'Recording' : 'Stopped'}
          </Badge>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Session Time:</span>
            <span className="font-mono text-foreground">
              {formatSessionTime(sessionDuration)}
            </span>
          </div>
        </div>

        {/* Right Section - Volume Control */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-muted-foreground" />
            <div className="w-24">
              <Slider
                value={[masterVolume]}
                onValueChange={handleVolumeChange}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
            <span className="text-sm text-muted-foreground w-8">
              {masterVolume}%
            </span>
          </div>
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