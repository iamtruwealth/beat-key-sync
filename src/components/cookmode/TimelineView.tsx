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
  const DEBUG_TIMELINE = true;
  const tlog = (...args: any[]) => DEBUG_TIMELINE && console.log('[Timeline]', ...args);
  tlog('render', { isPlaying, currentTime, tracksCount: tracks.length });
  const [activeTool] = useState<ToolType>('draw');
  const [snapEnabled] = useState(true);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [selectedClips, setSelectedClips] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [trackDurations, setTrackDurations] = useState<Map<string, number>>(new Map());
  const { toast } = useToast();
  const lastLogRef = useRef<Map<string, number>>(new Map());
  const prevTimeRef = useRef<Map<string, number>>(new Map());
  const loopSignalRef = useRef<number>(0);
  const prevSessionTimeRef = useRef<number>(0);
  const playingRef = useRef<boolean>(isPlaying);
  // Calculate loop length based on actual audio duration (not fixed 4 bars)
  const maxTrackDuration = Math.max(...tracks.map(t => trackDurations.get(t.id) || t.analyzed_duration || t.duration || 0), 0);
  const loopLength = maxTrackDuration > 0 ? maxTrackDuration : (16 * 60 / bpm); // Use actual track length or fallback to 4 bars
  
  // Calculate how many bars this represents
  const secondsPerBeat = 60 / bpm;
  const beatsPerBar = 4;
  const secondsPerBar = secondsPerBeat * beatsPerBar;
  const loopBars = Math.round(loopLength / secondsPerBar);
  
  // Timeline display calculations  
  const timelineLength = Math.max(loopLength, 32); // At least 32 seconds visible
  const totalBars = Math.ceil(timelineLength / secondsPerBar);
  const pixelsPerSecond = 40 * zoom;
  const pixelsPerBeat = pixelsPerSecond * secondsPerBeat;
  const pixelsPerBar = pixelsPerBeat * beatsPerBar;
  
  console.log('Loop calculation:', { 
    maxTrackDuration, 
    loopLength, 
    loopBars, 
    bpm,
    secondsPerBar 
  });

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

  // Keep playingRef in sync with isPlaying
  useEffect(() => {
    playingRef.current = isPlaying;
  }, [isPlaying]);

  // Initialize audio elements ONCE per track - never recreate
  useEffect(() => {
    tracks.forEach(track => {
      if (!audioElementsRef.current.has(track.id)) {
        tlog('Creating audio element for track:', track.id, track.name);
        
        const audio = new Audio();
        audio.volume = 0.8;
        audio.crossOrigin = "anonymous";
        audio.preload = 'auto';
        audio.loop = false; // Manual loop via session timer

        // Debug event listeners
        const onPlay = () => tlog('audio:play', track.id, { ct: audio.currentTime.toFixed(3) });
        const onPause = () => tlog('audio:pause', track.id, { ct: audio.currentTime.toFixed(3) });
        const onEnded = () => { 
          tlog('audio:ended', track.id, { ct: audio.currentTime.toFixed(3) });
          if (playingRef.current) {
            audio.currentTime = 0;
            audio.play().catch((e) => tlog('ended-restart error', track.id, e));
            tlog('ended-restart', track.id);
          }
        };
        const onWaiting = () => tlog('audio:waiting', track.id);
        const onStalled = () => tlog('audio:stalled', track.id);
        const onSeeking = () => tlog('audio:seeking', track.id, { to: audio.currentTime.toFixed(3) });
        const onSeeked = () => tlog('audio:seeked', track.id, { ct: audio.currentTime.toFixed(3) });
        const onError = () => tlog('audio:error', track.id, audio.error);
        const onLoadedMeta = () => tlog('audio:loadedmetadata', track.id, { duration: audio.duration });

        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('waiting', onWaiting);
        audio.addEventListener('stalled', onStalled);
        audio.addEventListener('seeking', onSeeking);
        audio.addEventListener('seeked', onSeeked);
        audio.addEventListener('error', onError);
        audio.addEventListener('loadedmetadata', onLoadedMeta);

        audio.addEventListener('timeupdate', () => {
          const now = Date.now();
          const last = lastLogRef.current.get(track.id) || 0;
          const prev = prevTimeRef.current.get(track.id) || 0;
          const ct = audio.currentTime;
          // Near-end wrap fallback to avoid stalls if native loop misses by a few ms
          if (Number.isFinite(audio.duration) && audio.duration > 0 && (audio.duration - ct) <= 0.2) {
            tlog('loop:wrap-near-end', track.id, { ct: ct.toFixed(3), dur: audio.duration.toFixed(3) });
            audio.currentTime = 0;
            if (playingRef.current && audio.paused) {
              audio.play().catch((e) => tlog('wrap-replay error', track.id, e));
            }
          }
          // Throttle logs
          if (now - last > 500) {
            const deltaToSession = Math.abs(ct - currentTime);
            tlog('audio:timeupdate', track.id, {
              ct: ct.toFixed(3),
              duration: Number.isFinite(audio.duration) ? audio.duration.toFixed(3) : 'n/a',
              sessionTime: currentTime.toFixed(3),
              drift: deltaToSession.toFixed(3)
            });
            lastLogRef.current.set(track.id, now);
          }
          
          // Detect native loop (time jump backwards)
          if (prev && ct + 0.05 < prev) {
            tlog('audio:native-loop', track.id, { from: prev.toFixed(3), to: ct.toFixed(3) });
          }
          prevTimeRef.current.set(track.id, ct);
        });
        
        audio.addEventListener('loadeddata', () => {
          tlog('audio:loadeddata', track.name, 'duration:', audio.duration);
          const finiteDur = Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration < 3600
            ? audio.duration
            : (track.analyzed_duration || track.duration || 0);
          if (finiteDur > 0) {
            setTrackDurations(prev => new Map(prev.set(track.id, finiteDur)));
          }
        });
        
        audio.src = track.file_url;
        audio.load();
        audioElementsRef.current.set(track.id, audio);
      }
    });

    // Clean up removed tracks
    const currentTrackIds = new Set(tracks.map(t => t.id));
    audioElementsRef.current.forEach((audio, trackId) => {
      if (!currentTrackIds.has(trackId)) {
        audio.pause();
        audio.src = '';
        audioElementsRef.current.delete(trackId);
        tlog('Removed audio element for track', trackId);
      }
    });
  }, [JSON.stringify(tracks.map(t => ({ id: t.id, url: t.file_url })))]); // Only recreate if track IDs or URLs change

  // Simple playback control - sync UI to actual audio time
  useEffect(() => {
    audioElementsRef.current.forEach((audio, trackId) => {
      const track = tracks.find(t => t.id === trackId);
      if (isPlaying) {
        if (track) audio.muted = !!track.isMuted;
        const desired = loopLength > 0 ? (currentTime % loopLength) : currentTime;
        if (audio.paused) {
          tlog('Starting audio', trackId, { setTo: desired.toFixed(3) });
          audio.currentTime = desired;
          audio.play().catch((e) => tlog('audio.play error', trackId, e));
        }
      } else {
        if (!audio.paused) {
          tlog('Pausing audio', trackId, { at: audio.currentTime.toFixed(3) });
          audio.pause();
        }
        audio.currentTime = 0;
        // Keep source but ensure it's truly stopped
        audio.muted = true;
      }
    });
  }, [isPlaying, loopLength, currentTime, tracks]);

  // Force stop all audio when not playing
  useEffect(() => {
    if (!isPlaying) {
      audioElementsRef.current.forEach((audio, trackId) => {
        if (!audio.paused) {
          tlog('Force stopping audio', trackId);
          audio.pause();
          audio.currentTime = 0;
        }
      });
    }
  }, [isPlaying]);

  // Sync audio only on explicit seeks (large jumps), avoid fighting native loop
  useEffect(() => {
    if (!isPlaying) return;

    const desired = loopLength > 0 ? (currentTime % loopLength) : currentTime;
    const sessionJump = Math.abs(currentTime - prevSessionTimeRef.current);
    const isExplicitSeek = sessionJump > 0.5; // treat big jumps as seeks

    if (isExplicitSeek) {
      audioElementsRef.current.forEach((audio, trackId) => {
        if (!audio.paused) {
          const delta = Math.abs(audio.currentTime - desired);
          if (delta > 0.05) {
            tlog('Seek resync', trackId, { desired: desired.toFixed(3), delta: delta.toFixed(3) });
            audio.currentTime = desired;
          }
        }
      });
    }

    prevSessionTimeRef.current = currentTime;
  }, [currentTime, isPlaying, loopLength]);

  // Global cleanup on unmount to ensure no stray audio keeps playing
  useEffect(() => {
    return () => {
      audioElementsRef.current.forEach((audio, trackId) => {
        try {
          tlog('Unmount cleanup: stopping audio', trackId);
          audio.pause();
          audio.src = '';
          audio.load();
        } catch (e) {
          tlog('Cleanup error', trackId, e);
        }
      });
      audioElementsRef.current.clear();
    };
  }, []);

  // Update track volume/mute without recreating audio elements
   useEffect(() => {
     tracks.forEach(track => {
       const audio = audioElementsRef.current.get(track.id);
       if (audio) {
         audio.volume = track.volume || 0.8;
         audio.muted = track.isMuted || false;
       }
     });
   }, [tracks.map(t => `${t.id}-${t.volume}-${t.isMuted}`).join(',')]);

   // Propagate detected durations to parent so global timer can loop correctly
   useEffect(() => {
     if (!onTracksUpdate) return;
     const updated = tracks.map(t => ({
       ...t,
       duration: trackDurations.get(t.id) || t.duration || 0,
     }));
     onTracksUpdate(updated);
   }, [onTracksUpdate, tracks, trackDurations]);

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
                className="absolute top-0 h-full w-1 bg-red-500 z-20 pointer-events-none shadow-lg"
                style={{ left: `${((loopLength > 0 ? (currentTime % loopLength) : currentTime) * pixelsPerSecond)}px` }}
               >
                 <div className="absolute top-0 w-3 h-3 bg-red-500 rounded-full -translate-x-1 -translate-y-1"></div>
                 <div className="absolute -top-6 -left-8 text-xs bg-black/80 text-white px-1 rounded">
                   {formatTime(loopLength > 0 ? (currentTime % loopLength) : currentTime)}
                 </div>
              </div>
              
              {/* Loop region indicator - based on actual track length */}
              <div
                className="absolute top-0 h-full bg-primary/10 border-l-2 border-r-2 border-primary/30 z-10 pointer-events-none"
                style={{ 
                  left: '0px',
                  width: `${loopLength * pixelsPerSecond}px`
                }}
              >
                <div className="absolute -top-6 left-2 text-xs text-primary font-medium">
                  Loop: {loopBars} bars ({formatTime(loopLength)})
                </div>
                {maxTrackDuration > 0 && (
                  <div className="absolute -top-12 left-2 text-xs text-green-400 font-medium">
                    Track: {formatTime(maxTrackDuration)}
                  </div>
                )}
              </div>
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