import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { BPMSyncIndicator } from './BPMSyncIndicator';
import { useToast } from "@/hooks/use-toast";
import { useWaveformGenerator } from '@/hooks/useWaveformGenerator';
import { generateWaveformBars } from '@/lib/waveformGenerator';

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
  analyzed_duration?: number; // Actual audio duration from analysis
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
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const blobSrcTriedRef = useRef<Set<string>>(new Set());
  const [trackDurations, setTrackDurations] = useState<Map<string, number>>(new Map());
  const { toast } = useToast();

  // Calculate timing constants
  const secondsPerBeat = 60 / bpm;
  const beatsPerBar = 4;
  const secondsPerBar = secondsPerBeat * beatsPerBar;
  const maxDuration = Math.max(...tracks.map(t => trackDurations.get(t.id) || t.analyzed_duration || t.duration || 60), 60);
  const totalBars = Math.ceil(maxDuration / secondsPerBar);
  const pixelsPerSecond = 40;
  const pixelsPerBeat = pixelsPerSecond * secondsPerBeat;
  const pixelsPerBar = pixelsPerBeat * beatsPerBar;

  // Initialize audio elements for all tracks
  useEffect(() => {
    tracks.forEach(track => {
      if (!audioElementsRef.current.has(track.id)) {
        console.log('Creating audio element for track:', track.name, 'URL:', track.file_url);
        
        if (!track.file_url) {
          console.error('Track has no file_url:', track);
          toast({
            title: "Audio Error",
            description: `Track ${track.name} has no audio file`,
            variant: "destructive"
          });
          return;
        }

        const audio = new Audio();
        audio.volume = track.volume !== undefined ? track.volume : 1;
        audio.muted = track.isMuted || false;
        audio.currentTime = currentTime;
        audio.crossOrigin = "anonymous"; // For CORS
        audio.preload = 'auto';
        
        audio.addEventListener('loadeddata', () => {
          console.log('Audio loaded successfully for:', track.name);
          // Update actual duration from audio element
          const actualDuration = audio.duration;
          if (actualDuration && actualDuration > 0) {
            setTrackDurations(prev => new Map(prev.set(track.id, actualDuration)));
          }
          // Set base volume for master fader control
          audio.setAttribute('data-base-volume', (track.volume !== undefined ? track.volume : 1).toString());
        });
        
        audio.addEventListener('canplay', () => {
          console.log('Audio can play:', track.name);
          // Sync with current playback state
          if (isPlaying) {
            audio.currentTime = currentTime;
            audio.play().catch(error => {
              console.error('Error starting playback:', error);
            });
          }
        });

        audio.addEventListener('ended', () => {
          console.log('Audio ended for track:', track.name);
          // Ensure audio is properly stopped and reset
          audio.pause();
          audio.currentTime = 0;
        });

        audio.addEventListener('timeupdate', () => {
          // Get actual duration from the audio element
          const actualDuration = trackDurations.get(track.id) || track.analyzed_duration || track.duration || audio.duration;
          
          // Stop audio if it exceeds the expected duration to prevent noise
          if (actualDuration && audio.currentTime >= actualDuration) {
            console.log(`Stopping track ${track.name} at ${audio.currentTime}s (duration: ${actualDuration}s)`);
            audio.pause();
            audio.currentTime = actualDuration; // Set to exact end
          }
        });
        
        audio.addEventListener('error', async (e) => {
          console.error('Audio error for track:', track.name, e, 'Audio error object:', audio.error);

          // Attempt blob fallback once per track
          if (!blobSrcTriedRef.current.has(track.id)) {
            blobSrcTriedRef.current.add(track.id);
            try {
              console.log('Attempting blob fallback for:', track.name);
              const res = await fetch(track.file_url, { mode: 'cors' });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const blob = await res.blob();
              const objectUrl = URL.createObjectURL(blob);
              audio.src = objectUrl;
              audio.load();
              if (isPlaying) {
                audio.currentTime = currentTime;
                await audio.play();
              }
              return;
            } catch (fallbackErr) {
              console.error('Blob fallback failed for:', track.name, fallbackErr);
            }
          }

          toast({
            title: "Audio Error",
            description: `Could not load ${track.name}: ${audio.error?.message || 'Unsupported or blocked source'}`,
            variant: "destructive"
          });
        });
        
        // Set the source after adding event listeners
        audio.src = track.file_url;
        audio.load(); // Explicitly load the audio
        
        audioElementsRef.current.set(track.id, audio);
      }
    });

    // Remove audio elements for tracks that no longer exist
    audioElementsRef.current.forEach((audio, trackId) => {
      if (!tracks.find(t => t.id === trackId)) {
        audio.pause();
        audio.src = '';
        audioElementsRef.current.delete(trackId);
      }
    });
  }, [tracks, toast]);

  // Sync playback state with main controls
  useEffect(() => {
    console.log('Timeline syncing playback state:', { isPlaying, audioElementsCount: audioElementsRef.current.size });
    audioElementsRef.current.forEach((audio, trackId) => {
      try {
        if (!audio.src) {
          // Skip elements with empty source (cleanup state)
          return;
        }
        if (isPlaying && audio.paused) {
          console.log('Starting playback for track:', trackId);
          
          // Check if we're within the track's actual duration
          const actualDuration = trackDurations.get(trackId) || tracks.find(t => t.id === trackId)?.analyzed_duration || tracks.find(t => t.id === trackId)?.duration || audio.duration;
          
          if (actualDuration && currentTime >= actualDuration) {
            // Don't start playback if we're past the track's end
            console.log(`Not starting track ${trackId} - past duration (${currentTime}s >= ${actualDuration}s)`);
            return;
          }
          
          audio.currentTime = currentTime;
          
          // Create a user interaction promise to satisfy browser autoplay policies
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log('Audio started successfully for:', trackId);
              })
              .catch(error => {
                console.error('Autoplay prevented for track:', trackId, error);
                if (error.name === 'NotAllowedError') {
                  toast({
                    title: "User Interaction Required",
                    description: "Click anywhere to enable audio playback",
                  });
                }
              });
          }
        } else if (!isPlaying && !audio.paused) {
          console.log('Pausing playback for track:', trackId);
          audio.pause();
        }
      } catch (error) {
        console.error('Error syncing audio playback:', error);
      }
    });
  }, [isPlaying, currentTime, toast]);

  // Sync current time - less frequent updates
  useEffect(() => {
    audioElementsRef.current.forEach((audio, trackId) => {
      const actualDuration = trackDurations.get(trackId) || tracks.find(t => t.id === trackId)?.analyzed_duration || tracks.find(t => t.id === trackId)?.duration || audio.duration;
      
      // Stop audio if it's playing beyond its duration
      if (actualDuration && audio.currentTime >= actualDuration && !audio.paused) {
        console.log(`Auto-stopping track ${trackId} at end of duration`);
        audio.pause();
        audio.currentTime = actualDuration;
        return;
      }
      
      // Only seek if there's a significant difference and we're within track duration
      if (Math.abs(audio.currentTime - currentTime) > 1.0) {
        if (!actualDuration || currentTime < actualDuration) {
          console.log(`Seeking track ${trackId} from ${audio.currentTime} to ${currentTime}`);
          audio.currentTime = currentTime;
        }
      }
    });
  }, [currentTime, trackDurations, tracks]);

  // Audio playback handler for individual tracks (toggle mute/solo)
  const handleTrackPlay = useCallback(async (track: Track) => {
    const audio = audioElementsRef.current.get(track.id);
    if (audio) {
      audio.muted = !audio.muted;
      toast({
        title: audio.muted ? "Track Muted" : "Track Unmuted",
        description: track.name,
      });
    }
  }, [toast]);

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
      const audio = audioElementsRef.current.get(track.id);
      if (audio) {
        const newVolume = track.volume !== undefined ? track.volume : 1;
        audio.volume = newVolume;
        audio.muted = track.isMuted || false;
        // Update base volume for master fader control
        audio.setAttribute('data-base-volume', newVolume.toString());
        
        // Also check if track should be stopped due to duration
        const actualDuration = trackDurations.get(track.id) || track.analyzed_duration || track.duration || audio.duration;
        if (actualDuration && audio.currentTime >= actualDuration && !audio.paused) {
          console.log(`Stopping track ${track.name} - exceeded duration`);
          audio.pause();
          audio.currentTime = actualDuration;
        }
      }
    });
  }, [tracks, trackDurations]);

  // Cleanup audio elements when component unmounts
  useEffect(() => {
    return () => {
      audioElementsRef.current.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        // Remove all event listeners
        audio.removeEventListener('loadeddata', () => {});
        audio.removeEventListener('canplay', () => {});
        audio.removeEventListener('ended', () => {});
        audio.removeEventListener('timeupdate', () => {});
        audio.removeEventListener('error', () => {});
      });
      audioElementsRef.current.clear();
    };
  }, []);

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

  const WaveformTrack: React.FC<{ 
    track: Track; 
    index: number; 
    pixelsPerSecond: number; 
    trackHeight: number;
  }> = ({ track, index, pixelsPerSecond, trackHeight }) => {
    const { waveformData, isLoading } = useWaveformGenerator({ 
      audioUrl: track.file_url,
      targetWidth: 500 
    });

    const trackY = index * trackHeight;
    const actualDuration = trackDurations.get(track.id) || track.analyzed_duration || track.duration || 60;
    const trackWidth = actualDuration * pixelsPerSecond;

    // Generate waveform bars for visualization
    const waveformBars = waveformData ? generateWaveformBars(waveformData.peaks, Math.floor(trackWidth / 4)) : [];

    return (
      <div
        className="absolute bg-gradient-to-r from-primary/20 to-primary/40 border border-primary/30 rounded overflow-hidden"
        style={{
          top: trackY + 8,
          left: 0,
          width: trackWidth,
          height: trackHeight - 16
        }}
      >
        {/* Waveform visualization */}
        <div className="h-full p-1 flex items-center">
          {isLoading ? (
            <div className="flex-1 h-8 bg-gradient-to-r from-neon-cyan/20 to-electric-blue/20 rounded flex items-center justify-center">
              <span className="text-xs text-foreground/60">Loading...</span>
            </div>
          ) : waveformBars.length > 0 ? (
            <div className="flex-1 h-8 flex items-end justify-center gap-px">
              {waveformBars.map((bar, i) => (
                <div
                  key={i}
                  className="bg-gradient-to-t from-neon-cyan/60 to-electric-blue/60 rounded-sm min-w-[1px]"
                  style={{
                    height: `${Math.max(bar * 100, 2)}%`,
                    width: Math.max(trackWidth / waveformBars.length - 1, 1)
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex-1 h-8 bg-gradient-to-r from-neon-cyan/20 to-electric-blue/20 rounded flex items-center justify-center">
              <span className="text-xs text-foreground/60">
                {actualDuration.toFixed(1)}s
              </span>
            </div>
          )}
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
            detectedBPM={waveformData ? undefined : 120} // Use actual BPM when available
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
              {tracks.map((track, index) => (
                <WaveformTrack 
                  key={track.id}
                  track={track} 
                  index={index} 
                  pixelsPerSecond={pixelsPerSecond}
                  trackHeight={68}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};