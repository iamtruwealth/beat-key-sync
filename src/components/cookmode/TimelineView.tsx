import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { BPMSyncIndicator } from './BPMSyncIndicator';
import { useToast } from "@/hooks/use-toast";

interface Track {
  id: string;
  name: string;
  file_url: string;
  stem_type: string;
  duration?: number;
  volume?: number;
  isMuted?: boolean;
  isSolo?: boolean;
  waveform_data?: number[];
}

interface TimelineViewProps {
  tracks: Track[];
  isPlaying: boolean;
  currentTime: number;
  bpm: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  tracks,
  isPlaying,
  currentTime,
  bpm,
  onPlayPause,
  onSeek
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(32);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());
  const { toast } = useToast();

  // Calculate timing constants
  const secondsPerBeat = 60 / bpm;
  const beatsPerBar = 4;
  const secondsPerBar = secondsPerBeat * beatsPerBar;
  const maxDuration = Math.max(...tracks.map(t => t.duration || 60), 60);
  const totalBars = Math.ceil(maxDuration / secondsPerBar);
  const pixelsPerSecond = 40;
  const pixelsPerBeat = pixelsPerSecond * secondsPerBeat;
  const pixelsPerBar = pixelsPerBeat * beatsPerBar;

  // Initialize audio elements for all tracks
  useEffect(() => {
    tracks.forEach(track => {
      if (!audioElements.has(track.id)) {
        const audio = new Audio(track.file_url);
        audio.volume = (track.volume || 100) / 100;
        audio.muted = track.isMuted || false;
        audio.currentTime = currentTime;
        
        // Sync with current playback state
        if (isPlaying) {
          audio.play().catch(console.error);
        }
        
        audio.addEventListener('error', (e) => {
          console.error('Audio error for track:', track.name, e);
          toast({
            title: "Playback Error",
            description: `Could not load ${track.name}`,
            variant: "destructive"
          });
        });
        
        setAudioElements(prev => new Map(prev.set(track.id, audio)));
      }
    });

    // Remove audio elements for tracks that no longer exist
    audioElements.forEach((audio, trackId) => {
      if (!tracks.find(t => t.id === trackId)) {
        audio.pause();
        audio.src = '';
        setAudioElements(prev => {
          const newMap = new Map(prev);
          newMap.delete(trackId);
          return newMap;
        });
      }
    });
  }, [tracks, toast]);

  // Sync playback state with main controls
  useEffect(() => {
    console.log('Timeline syncing playback state:', { isPlaying, audioElementsCount: audioElements.size });
    audioElements.forEach((audio, trackId) => {
      try {
        if (isPlaying && audio.paused) {
          console.log('Starting playback for track:', trackId);
          audio.currentTime = currentTime;
          audio.play().catch(console.error);
        } else if (!isPlaying && !audio.paused) {
          console.log('Pausing playback for track:', trackId);
          audio.pause();
        }
      } catch (error) {
        console.error('Error syncing audio playback:', error);
      }
    });
  }, [isPlaying, audioElements]);

  // Sync current time
  useEffect(() => {
    audioElements.forEach(audio => {
      if (Math.abs(audio.currentTime - currentTime) > 0.5) {
        audio.currentTime = currentTime;
      }
    });
  }, [currentTime, audioElements]);

  // Audio playback handler for individual tracks (toggle mute/solo)
  const handleTrackPlay = useCallback(async (track: Track) => {
    const audio = audioElements.get(track.id);
    if (audio) {
      audio.muted = !audio.muted;
      toast({
        title: audio.muted ? "Track Muted" : "Track Unmuted",
        description: track.name,
      });
    }
  }, [audioElements, toast]);

  // Update timeline width
  useEffect(() => {
    if (timelineRef.current) {
      setTimelineWidth(timelineRef.current.offsetWidth);
    }
  }, []);

  // Handle loop logic
  useEffect(() => {
    if (isLooping && currentTime >= loopEnd) {
      onSeek(loopStart);
    }
  }, [currentTime, isLooping, loopStart, loopEnd, onSeek]);

  // Update track volumes and mute states
  useEffect(() => {
    tracks.forEach(track => {
      const audio = audioElements.get(track.id);
      if (audio) {
        audio.volume = (track.volume || 100) / 100;
        audio.muted = track.isMuted || false;
      }
    });
  }, [tracks, audioElements]);

  // Cleanup audio elements when component unmounts
  useEffect(() => {
    return () => {
      audioElements.forEach(audio => {
        audio.pause();
        audio.src = '';
      });
    };
  }, [audioElements]);

  const handleTimelineClick = useCallback((event: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const time = (x / pixelsPerSecond);
    onSeek(Math.max(0, Math.min(time, maxDuration)));
  }, [pixelsPerSecond, maxDuration, onSeek]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPosition = (seconds: number) => {
    const bar = Math.floor(seconds / secondsPerBar) + 1;
    const beat = Math.floor((seconds % secondsPerBar) / secondsPerBeat) + 1;
    return `${bar}.${beat}`;
  };

  const getStemColor = (stemType: string) => {
    const colors = {
      melody: '#00f5ff',
      drums: '#0080ff', 
      bass: '#ff00ff',
      vocal: '#00f5ff',
      fx: '#0080ff',
      other: '#888888'
    };
    return colors[stemType as keyof typeof colors] || colors.other;
  };

  const renderBarMarkers = () => {
    const markers = [];
    for (let bar = 0; bar < totalBars; bar++) {
      markers.push(
        <div
          key={bar}
          className="absolute top-0 bottom-0 border-l border-border/30"
          style={{ left: bar * pixelsPerBar }}
        >
          <span className="absolute -top-6 left-1 text-xs text-muted-foreground">
            {bar + 1}
          </span>
        </div>
      );
      
      // Beat markers
      for (let beat = 1; beat < beatsPerBar; beat++) {
        markers.push(
          <div
            key={`${bar}-${beat}`}
            className="absolute top-0 bottom-0 border-l border-border/20"
            style={{ left: bar * pixelsPerBar + beat * pixelsPerBeat }}
          />
        );
      }
    }
    return markers;
  };

  const renderTrack = (track: Track, index: number) => {
    const trackHeight = 64;
    const trackY = index * trackHeight;
    
    return (
      <div
        key={track.id}
        className="absolute bg-gradient-to-r from-primary/20 to-primary/40 border border-primary/30 rounded"
        style={{
          top: trackY + 8,
          left: 0,
          width: (track.duration || 60) * pixelsPerSecond,
          height: trackHeight - 16
        }}
      >
        {/* Waveform placeholder */}
        <div className="h-full p-2 flex items-center">
          <div className="flex-1 h-8 bg-gradient-to-r from-neon-cyan/20 to-electric-blue/20 rounded flex items-center justify-center">
            <span className="text-xs text-foreground/60">
              {track.duration ? `${track.duration.toFixed(1)}s` : 'Audio'}
            </span>
          </div>
        </div>

        {/* Mute/Solo overlay */}
        {(track.isMuted || (tracks.some(t => t.isSolo) && !track.isSolo)) && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">
              {track.isMuted ? 'MUTED' : 'SOLO OFF'}
            </span>
          </div>
        )}

        {/* BPM sync indicator */}
        <div className="absolute top-1 right-1">
          <BPMSyncIndicator 
            detectedBPM={track.duration ? 120 : undefined} // Placeholder
            sessionBPM={bpm}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-background/50">
      {/* Timeline Header */}
      <div className="p-4 border-b border-border/50 bg-card/20 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Arrangement View</h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono">
              {formatPosition(currentTime)}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {formatTime(currentTime)}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {bpm} BPM
            </Badge>
          </div>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPlayPause}
            className="border-border/50"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSeek(0)}
            className="border-border/50"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          <Button
            variant={isLooping ? "default" : "outline"}
            size="sm"
            onClick={() => setIsLooping(!isLooping)}
            className="border-border/50"
          >
            Loop
          </Button>
        </div>
      </div>

      {/* Main Timeline Area */}
      <div className="flex-1 relative overflow-auto">
        <div className="flex">
          {/* Track names sidebar */}
          <div className="w-48 flex-shrink-0 bg-card/10 border-r border-border/30">
            <div className="h-8"></div> {/* Spacer for ruler */}
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className="h-16 border-b border-border/20 p-2 flex flex-col justify-center group cursor-pointer hover:bg-card/20 transition-colors"
                onClick={() => handleTrackPlay(track)}
                title={track.name} // Show full name on hover
              >
                <div className="text-xs font-medium text-foreground truncate max-w-full mb-1">
                  {track.name}
                </div>
                <div className="flex items-center justify-between">
                  <Badge 
                    variant="outline" 
                    className="text-xs"
                    style={{ color: getStemColor(track.stem_type) }}
                  >
                    {track.stem_type}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrackPlay(track);
                    }}
                  >
                    <Play className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Timeline area */}
          <div className="flex-1 relative">
            {/* Ruler */}
            <div 
              className="h-8 bg-card/20 border-b border-border/30 relative"
              style={{ width: totalBars * pixelsPerBar }}
            >
              {renderBarMarkers()}
            </div>

            {/* Tracks area */}
            <div
              ref={timelineRef}
              className="relative cursor-pointer"
              style={{ 
                height: tracks.length * 68,
                minHeight: 200,
                width: totalBars * pixelsPerBar
              }}
              onClick={handleTimelineClick}
            >
              {/* Loop region */}
              {isLooping && (
                <div
                  className="absolute top-0 bottom-0 bg-neon-cyan/10 border-x-2 border-neon-cyan/50"
                  style={{
                    left: loopStart * pixelsPerSecond,
                    width: (loopEnd - loopStart) * pixelsPerSecond
                  }}
                >
                  <div className="absolute -top-8 left-0 text-xs text-neon-cyan">
                    {formatPosition(loopStart)}
                  </div>
                  <div className="absolute -top-8 right-0 text-xs text-neon-cyan">
                    {formatPosition(loopEnd)}
                  </div>
                </div>
              )}

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-neon-cyan shadow-neon-cyan shadow-[0_0_10px] z-10"
                style={{ left: currentTime * pixelsPerSecond }}
              >
                <div className="absolute -top-2 -left-2 w-4 h-4 bg-neon-cyan rounded-full shadow-neon-cyan shadow-[0_0_10px]" />
              </div>

              {/* Track waveforms */}
              {tracks.map((track, index) => renderTrack(track, index))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};