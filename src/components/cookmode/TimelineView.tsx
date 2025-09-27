import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { BPMSyncIndicator } from './BPMSyncIndicator';
import { useToast } from "@/hooks/use-toast";
import { ToolType } from './CookModeToolbar';

interface Track {
  id: string;
  name: string;
  file_url: string;
  stem_type: string;
  duration?: number;
  volume?: number;
  isMuted?: boolean;
  isSolo?: boolean;
  waveformData?: number[];
  analyzed_duration?: number;
}

interface TimelineViewProps {
  tracks: Track[];
  isPlaying: boolean;
  currentTime: number;
  bpm: number;
  sessionBpm?: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onTracksUpdate?: (tracks: Track[]) => void;
  onToolAction?: (action: string, data: any) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  tracks,
  isPlaying,
  currentTime,
  bpm,
  sessionBpm,
  onPlayPause,
  onSeek,
  onTracksUpdate,
  onToolAction
}) => {
  const [activeTool] = useState<ToolType>('draw');
  const [snapEnabled] = useState(true);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [selectedClips, setSelectedClips] = useState<string[]>([]);
  const [timelineLength, setTimelineLength] = useState(60);
  const [zoom, setZoom] = useState(1);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [trackDurations, setTrackDurations] = useState<Map<string, number>>(new Map());
  const { toast } = useToast();

  // Calculate timing constants
  const secondsPerBeat = 60 / bpm;
  const beatsPerBar = 4;
  const secondsPerBar = secondsPerBeat * beatsPerBar;
  const maxDuration = Math.max(...tracks.map(t => trackDurations.get(t.id) || t.analyzed_duration || t.duration || 60), 60);
  const totalBars = Math.ceil(maxDuration / secondsPerBar);
  const pixelsPerSecond = 40 * zoom;
  const pixelsPerBeat = pixelsPerSecond * secondsPerBeat;
  const pixelsPerBar = pixelsPerBeat * beatsPerBar;

  const snapToGrid = useCallback((time: number) => {
    if (!snapEnabled) return time;
    
    const beatDuration = 60 / bpm;
    const snapInterval = beatDuration / 4;
    return Math.round(time / snapInterval) * snapInterval;
  }, [snapEnabled, bpm]);

  const handleClipClick = useCallback((trackId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    switch (activeTool) {
      case 'select':
        setSelectedClips(prev => 
          prev.includes(trackId) 
            ? prev.filter(id => id !== trackId)
            : [...prev, trackId]
        );
        break;
      case 'delete':
        onToolAction?.('delete', { trackId });
        break;
      case 'mute':
        onToolAction?.('mute', { trackId });
        break;
      case 'playback':
        onToolAction?.('play', { trackId });
        break;
      case 'draw':
      default:
        setSelectedClips([trackId]);
        break;
    }
  }, [activeTool, onToolAction]);

  const handleClipRightClick = useCallback((trackId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (activeTool === 'draw') {
      onToolAction?.('delete', { trackId });
    }
  }, [activeTool, onToolAction]);

  const getToolCursor = () => {
    switch (activeTool) {
      case 'draw': return 'cursor-pointer';
      case 'paint': return 'cursor-copy';
      case 'delete': return 'cursor-not-allowed';
      case 'mute': return 'cursor-pointer';
      case 'slice': return 'cursor-crosshair';
      case 'select': return 'cursor-pointer';
      case 'zoom': return 'cursor-zoom-in';
      case 'playback': return 'cursor-pointer';
      default: return 'cursor-default';
    }
  };

  const handleTimelineClick = useCallback((event: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const timelineWidth = rect.width - 200;
    const clickTime = (x - 200) / timelineWidth * timelineLength;
    
    if (clickTime >= 0) {
      const snappedTime = snapToGrid(clickTime);
      onSeek(Math.max(0, snappedTime));
    }
  }, [timelineLength, onSeek, snapToGrid]);

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
        audio.volume = track.volume !== undefined ? track.volume : 0.8;
        audio.muted = track.isMuted || false;
        audio.crossOrigin = "anonymous";
        audio.preload = 'metadata';
        audio.loop = false;
        
        audio.addEventListener('loadeddata', () => {
          console.log('Audio loaded successfully for:', track.name);
          const actualDuration = audio.duration;
          if (actualDuration && actualDuration > 0) {
            setTrackDurations(prev => new Map(prev.set(track.id, actualDuration)));
          }
        });
        
        audio.addEventListener('canplay', () => {
          console.log('Audio can play:', track.name);
          if (isPlaying) {
            // Don't reset to 0 for very small times - use the actual currentTime
            audio.currentTime = currentTime;
            audio.play().catch(error => {
              console.error('Error starting playback:', error);
            });
          } else {
            // Only reset to 0 if currentTime is actually 0
            if (currentTime === 0) {
              audio.currentTime = 0;
            }
          }
        });

        audio.addEventListener('error', (e) => {
          console.error('Audio error for track:', track.name, e);
          toast({
            title: "Audio Error",
            description: `Could not load ${track.name}`,
            variant: "destructive"
          });
        });
        
        audio.src = track.file_url;
        audio.load();
        
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

  // Sync playback state
  useEffect(() => {
    console.log('Playback sync effect triggered:', { isPlaying, currentTime, tracksCount: tracks.length });
    
    audioElementsRef.current.forEach((audio, trackId) => {
      try {
        if (!audio.src) return;
        
        if (isPlaying && audio.paused) {
          console.log('Starting playback for track:', trackId, 'at time:', currentTime, 'audio.currentTime:', audio.currentTime);
          
          // Always use the actual currentTime, don't reset small values to 0
          if (Math.abs(audio.currentTime - currentTime) > 0.1) {
            console.log('Adjusting audio time from', audio.currentTime, 'to', currentTime);
            audio.currentTime = currentTime;
          }
          
          audio.play().catch(error => {
            console.error('Error playing audio:', error);
          });
        } else if (!isPlaying && !audio.paused) {
          console.log('Pausing playback for track:', trackId);
          audio.pause();
        }
      } catch (error) {
        console.error('Error syncing playback for track:', trackId, error);
      }
    });
  }, [isPlaying, currentTime]);

  const getStemColor = (stemType: string): string => {
    const colors: Record<string, string> = {
      'drums': 'bg-red-500/20 border-red-500/50 text-red-400',
      'bass': 'bg-blue-500/20 border-blue-500/50 text-blue-400',
      'melody': 'bg-green-500/20 border-green-500/50 text-green-400',
      'vocals': 'bg-purple-500/20 border-purple-500/50 text-purple-400',
      'fx': 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
      'other': 'bg-gray-500/20 border-gray-500/50 text-gray-400'
    };
    return colors[stemType] || colors.other;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex flex-col h-full bg-background ${getToolCursor()}`}>
      {/* Timeline Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Timeline View</h3>
          <Badge variant="outline" className="text-xs">
            Tool: {activeTool}
          </Badge>
          {snapEnabled && (
            <Badge variant="outline" className="text-xs">
              Snap: ON
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
          >
            -
          </Button>
          <span className="text-sm text-muted-foreground min-w-16 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(prev => Math.min(4, prev + 0.25))}
          >
            +
          </Button>
        </div>
      </div>

      {/* Timeline Content */}
      <div 
        ref={timelineRef}
        className="flex-1 overflow-auto bg-background/50"
        onClick={handleTimelineClick}
      >
        <div className="relative min-h-full" style={{ width: `${200 + totalBars * pixelsPerBar}px` }}>
          {/* Time ruler */}
          <div className="sticky top-0 z-10 bg-background/90 border-b border-border/50 h-12 flex items-center">
            <div className="w-48 px-4 border-r border-border/50 text-sm font-medium">
              Timeline
            </div>
            <div className="flex-1 relative">
              {Array.from({ length: totalBars }, (_, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-border/20 flex items-center px-2"
                  style={{ left: `${i * pixelsPerBar}px`, width: `${pixelsPerBar}px` }}
                >
                  <span className="text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                </div>
              ))}
              
              {/* Playhead */}
              <div
                className="absolute top-0 h-full w-0.5 bg-primary z-20 pointer-events-none"
                style={{ left: `${(currentTime / timelineLength) * (totalBars * pixelsPerBar)}px` }}
              />
            </div>
          </div>

          {/* Track lanes */}
          <div className="space-y-1 p-1">
            {tracks.map((track) => (
              <div key={track.id} className="flex h-16 bg-card/30 rounded border border-border/50">
                {/* Track header */}
                <div className="w-48 p-3 border-r border-border/50 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{track.name}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="secondary" className={`text-xs ${getStemColor(track.stem_type)}`}>
                        {track.stem_type}
                      </Badge>
                      <BPMSyncIndicator 
                        detectedBPM={sessionBpm || 140} 
                        sessionBPM={bpm} 
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`w-6 h-6 p-0 ${track.isMuted ? 'text-muted-foreground' : 'text-foreground'}`}
                      onClick={() => onToolAction?.('mute', { trackId: track.id })}
                    >
                      {track.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>

                {/* Track timeline */}
                <div className="flex-1 relative">
                  <div 
                    className={`
                      relative h-12 bg-card border border-border/50 rounded-md overflow-hidden
                      transition-all duration-200 hover:border-primary/50 mx-2 my-2
                      ${selectedClips.includes(track.id) ? 'ring-2 ring-primary/50' : ''}
                      ${track.isMuted ? 'opacity-50' : ''}
                    `}
                    style={{
                      width: `${((trackDurations.get(track.id) || track.duration || 30) / timelineLength) * (totalBars * pixelsPerBar)}px`,
                    }}
                    onClick={(e) => handleClipClick(track.id, e)}
                    onContextMenu={(e) => handleClipRightClick(track.id, e)}
                  >
                    {/* Tool-specific visual feedback */}
                    {activeTool === 'slice' && (
                      <div className="absolute inset-0 pointer-events-none border border-yellow-400/50 bg-yellow-400/10" />
                    )}
                    {activeTool === 'delete' && (
                      <div className="absolute inset-0 pointer-events-none border border-red-400/50 bg-red-400/10" />
                    )}
                    {activeTool === 'mute' && track.isMuted && (
                      <div className="absolute inset-0 pointer-events-none border border-orange-400/50 bg-orange-400/10" />
                    )}
                    
                    {/* Clip Content */}
                    <div className="absolute inset-0 p-2 flex items-center">
                      <div className="flex items-center gap-2 text-xs text-foreground/80">
                        <Badge variant="secondary" className={`text-xs ${getStemColor(track.stem_type)}`}>
                          {track.stem_type}
                        </Badge>
                        <span className="truncate font-medium">{track.name}</span>
                        {track.isMuted && <VolumeX className="w-3 h-3" />}
                      </div>
                    </div>

                    {/* Resize handles for draw tool */}
                    {activeTool === 'draw' && selectedClips.includes(track.id) && (
                      <>
                        <div className="absolute left-0 top-0 w-1 h-full bg-primary cursor-w-resize" />
                        <div className="absolute right-0 top-0 w-1 h-full bg-primary cursor-e-resize" />
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};