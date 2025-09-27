import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { BPMSyncIndicator } from './BPMSyncIndicator';
import { useToast } from "@/hooks/use-toast";
import { useWaveformGenerator } from '@/hooks/useWaveformGenerator';
import { generateWaveformBars } from '@/lib/waveformGenerator';
import { AudioBridge } from './AudioBridge';
import { WaveformTrack } from './WaveformTrack';
import { DraggableClip } from './DraggableClip';
import { undoManager, ActionType, createMoveAction } from '@/lib/UndoManager';

interface Track {
  id: string;
  name: string;
  file_url: string;
  stem_type: string;
  duration?: number;
  bars?: number; // Number of bars in this track
  volume?: number;
  isMuted?: boolean;
  isSolo?: boolean;
  waveform_data?: number[];
  analyzed_duration?: number; // Actual audio duration from analysis
}

interface AudioClip {
  id: string;
  trackId: string;
  startTime: number;
  endTime: number;
  originalTrack: Track;
  isSelected?: boolean;
}

interface TimelineViewProps {
  tracks: Track[];
  isPlaying: boolean;
  currentTime: number;
  bpm: number;
  metronomeEnabled?: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onTracksUpdate?: (tracks: Track[]) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  tracks,
  isPlaying,
  currentTime,
  bpm,
  metronomeEnabled = false,
  onPlayPause,
  onSeek,
  onTracksUpdate
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [trackDurations, setTrackDurations] = useState<Map<string, number>>(new Map());
  const [masterVolume, setMasterVolume] = useState(100);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [copiedClip, setCopiedClip] = useState<AudioClip | null>(null);
  const { toast } = useToast();

  // Calculate timing constants with precise BPM
  const secondsPerBeat = 60 / bpm; // Precise: 60 seconds / beats per minute
  const beatsPerBar = 4;
  const secondsPerBar = secondsPerBeat * beatsPerBar;

  // Calculate session length based purely on clips - no artificial limits
  const lastClipEndTime = Math.max(
    ...(audioClips.length > 0 ? audioClips.map(c => c.endTime) : [0]),
    ...tracks.map(track => {
      const knownDuration = trackDurations.get(track.id) || track.analyzed_duration || track.duration;
      if (knownDuration && knownDuration > 0) {
        const estimatedBars = Math.max(1, Math.round(knownDuration / secondsPerBar));
        return estimatedBars * secondsPerBar;
      }
      const clipBars = track.bars || 4; // Default to 4 bars if unknown
      return clipBars * secondsPerBar;
    }),
    0 // No minimum - let it be based purely on content
  );
    
  // Session duration is exactly the length of all clips - no artificial minimum
  const sessionDuration = lastClipEndTime || (8 * secondsPerBar); // Only fallback to 8 bars if no clips exist
  const totalBars = Math.ceil(sessionDuration / secondsPerBar);
  
  const pixelsPerSecond = 40;
  const pixelsPerBeat = pixelsPerSecond * secondsPerBeat;
  const pixelsPerBar = pixelsPerBeat * beatsPerBar;

  // Handle tick updates from AudioBridge
  const handleTick = useCallback((seconds: number) => {
    if (Math.abs(seconds - currentTime) > 0.05) {
      onSeek(seconds);
    }
  }, [currentTime, onSeek]);

  // Store track durations as clips are created
  useEffect(() => {
    if (tracks.length > 0) {
      tracks.forEach(track => {
        const knownDuration = track.analyzed_duration || track.duration;
        if (knownDuration && knownDuration > 0) {
          setTrackDurations(prev => new Map(prev.set(track.id, knownDuration)));
        } else if (track.bars) {
          const calculatedDuration = track.bars * secondsPerBar;
          setTrackDurations(prev => new Map(prev.set(track.id, calculatedDuration)));
        }
      });
    }
  }, [tracks, secondsPerBar]);

  // Initialize audio clips from tracks - preserve existing arrangement
  useEffect(() => {
    console.log('Checking clips initialization:', { 
      audioClipsLength: audioClips.length, 
      tracksLength: tracks.length,
      trackDurations: Array.from(trackDurations.entries()),
      trackNames: tracks.map(t => t.name)
    });
    
    if (tracks.length > 0) {
      // Find tracks that don't have any clips yet
      const existingTrackIds = new Set(audioClips.map(clip => clip.trackId));
      const newTracks = tracks.filter(track => !existingTrackIds.has(track.id));
      
      // Only create clips for NEW tracks, preserve existing clips
      if (newTracks.length > 0) {
        const newClips: AudioClip[] = newTracks.map(track => {
          // Prefer computed bars from actual duration if bars not provided
          const knownDuration = trackDurations.get(track.id) || track.analyzed_duration || track.duration;
          let resolvedBars: number = track.bars ?? 0;
          if (!resolvedBars) {
            if (knownDuration && knownDuration > 0) {
              resolvedBars = Math.max(1, Math.round(knownDuration / secondsPerBar));
            } else {
              // If no duration is known yet, default to 4 bars (not 8) and wait for analysis
              resolvedBars = 4; // More conservative default - 4 bars
            }
          }
          const clipDuration = resolvedBars * secondsPerBar;
          
          const clip: AudioClip = {
            id: `${track.id}-clip-0`,
            trackId: track.id,
            startTime: 0,
            endTime: clipDuration, // Use bars-based duration for clip length
            originalTrack: track
          };
          console.log('Creating clip for NEW track:', track.name, 'Bars:', resolvedBars, 'Duration:', clipDuration, 'Known duration:', knownDuration, 'Clip:', clip);
          return clip;
        });
        
        // Add new clips to existing ones instead of replacing
        console.log('Adding new clips to existing arrangement - existing:', audioClips, 'new:', newClips);
        setAudioClips(prev => [...prev, ...newClips]);
      }
      
      // Remove clips for tracks that no longer exist
      const currentTrackIds = new Set(tracks.map(t => t.id));
      setAudioClips(prev => {
        const filteredClips = prev.filter(clip => currentTrackIds.has(clip.trackId));
        if (filteredClips.length !== prev.length) {
          console.log('Removed clips for deleted tracks - before:', prev, 'after:', filteredClips);
        }
        return filteredClips;
      });
    }
  }, [tracks, trackDurations]);

  // Grid snapping function
  const snapToGrid = (time: number): number => {
    const beatTime = secondsPerBeat;
    return Math.round(time / beatTime) * beatTime;
  };

  // Copy clip function
  const copyClip = useCallback((clipId: string) => {
    const clip = audioClips.find(c => c.id === clipId);
    if (clip) {
      setCopiedClip(clip);
      console.log('Copied clip:', clip);
      toast({
        title: "Clip Copied",
        description: `${clip.originalTrack.name} copied to clipboard`,
      });
    } else {
      console.error('Could not find clip to copy:', clipId);
    }
  }, [audioClips, toast]);

  // Paste clip function
  const pasteClip = useCallback((targetTime: number, targetTrackId?: string) => {
    if (!copiedClip) {
      console.log('No clip to paste');
      return;
    }

    const snappedTime = snapToGrid(targetTime);
    const duration = copiedClip.endTime - copiedClip.startTime;
    const newClipId = `${copiedClip.originalTrack.id}-clip-${Date.now()}`;
    
    const newClip: AudioClip = {
      id: newClipId,
      trackId: targetTrackId || copiedClip.trackId,
      startTime: snappedTime,
      endTime: snappedTime + duration,
      originalTrack: copiedClip.originalTrack
    };

    console.log('Pasting clip:', newClip);
    setAudioClips(prev => [...prev, newClip]);
    toast({
      title: "Clip Pasted",
      description: `${copiedClip.originalTrack.name} pasted at ${Math.floor(snappedTime / secondsPerBar) + 1}.${Math.floor((snappedTime % secondsPerBar) / secondsPerBeat) + 1}`,
    });
  }, [copiedClip, snapToGrid, secondsPerBar, secondsPerBeat, toast]);

  // Duplicate clip function
  const duplicateClip = useCallback((clipId: string) => {
    const clip = audioClips.find(c => c.id === clipId);
    if (!clip) {
      console.error('Could not find clip to duplicate:', clipId);
      return;
    }

    const duration = clip.endTime - clip.startTime;
    const newStartTime = snapToGrid(clip.endTime);
    const newClipId = `${clip.originalTrack.id}-clip-${Date.now()}`;
    
    const newClip: AudioClip = {
      id: newClipId,
      trackId: clip.trackId,
      startTime: newStartTime,
      endTime: newStartTime + duration,
      originalTrack: clip.originalTrack
    };

    console.log('Duplicating clip:', clip, 'New clip:', newClip);
    setAudioClips(prev => [...prev, newClip]);
    toast({
      title: "Clip Duplicated",
      description: `${clip.originalTrack.name} duplicated`,
    });
  }, [audioClips, snapToGrid, toast]);

  // Move clip function
  const moveClip = useCallback((clipId: string, newStartTime: number) => {
    // Find the clip to get its original position
    const targetClip = audioClips.find(clip => clip.id === clipId);
    if (!targetClip) {
      console.warn('Clip not found for move operation:', clipId);
      return;
    }

    const originalStartTime = targetClip.startTime;
    const originalEndTime = targetClip.endTime;
    const duration = originalEndTime - originalStartTime;
    const newEndTime = newStartTime + duration;

    // Only proceed if the position actually changed
    if (Math.abs(newStartTime - originalStartTime) < 0.01) {
      return;
    }

    console.log(`🎵 Moving clip ${clipId} from ${originalStartTime}s to ${newStartTime}s`);

    // Update the clip position
    setAudioClips(prev => prev.map(clip => {
      if (clip.id === clipId) {
        return {
          ...clip,
          startTime: newStartTime,
          endTime: newEndTime
        };
      }
      return clip;
    }));

    // Register the move action with UndoManager
    const undoMoveAction = createMoveAction(
      targetClip.trackId,
      clipId,
      { startTime: originalStartTime, endTime: originalEndTime },
      { startTime: newStartTime, endTime: newEndTime },
      () => {
        console.log(`🔄 Undoing move of clip ${clipId} back to ${originalStartTime}s`);
        setAudioClips(prev => prev.map(clip => {
          if (clip.id === clipId) {
            return {
              ...clip,
              startTime: originalStartTime,
              endTime: originalEndTime
            };
          }
          return clip;
        }));
      },
      `Move clip from ${originalStartTime.toFixed(2)}s to ${newStartTime.toFixed(2)}s`
    );

    undoManager.push(undoMoveAction);
  }, [audioClips]);

  // Delete track function
  const deleteTrack = useCallback((trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    console.log('Deleting track:', track.name, 'ID:', trackId);
    
    // Remove all clips for this track
    setAudioClips(prev => {
      const filtered = prev.filter(clip => clip.trackId !== trackId);
      console.log('Clips after track deletion:', filtered);
      return filtered;
    });
    
    // Remove from selected clips
    setSelectedClips(prev => {
      const newSet = new Set(prev);
      prev.forEach(clipId => {
        const clip = audioClips.find(c => c.id === clipId);
        if (clip && clip.trackId === trackId) {
          newSet.delete(clipId);
        }
      });
      return newSet;
    });
    
    // Update tracks via callback
    if (onTracksUpdate) {
      const updatedTracks = tracks.filter(t => t.id !== trackId);
      onTracksUpdate(updatedTracks);
    }
    
    toast({
      title: "Track Deleted",
      description: `${track.name} removed from session`,
    });
  }, [tracks, audioClips, onTracksUpdate, toast]);

  // Delete clip function
  const deleteClip = useCallback((clipId: string) => {
    console.log('Deleting clip:', clipId);
    setAudioClips(prev => {
      const filtered = prev.filter(c => c.id !== clipId);
      console.log('Clips after deletion:', filtered);
      return filtered;
    });
    setSelectedClips(prev => {
      const newSet = new Set(prev);
      newSet.delete(clipId);
      return newSet;
    });
    toast({
      title: "Clip Deleted",
      description: "Audio clip removed",
    });
  }, [toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedClips.size === 0) return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'c':
            e.preventDefault();
            const firstSelected = Array.from(selectedClips)[0];
            copyClip(firstSelected);
            break;
          case 'v':
            e.preventDefault();
            pasteClip(currentTime);
            break;
          case 'd':
            e.preventDefault();
            selectedClips.forEach(clipId => duplicateClip(clipId));
            break;
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        selectedClips.forEach(clipId => deleteClip(clipId));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClips, copyClip, pasteClip, duplicateClip, deleteClip, currentTime]);

  // Audio playback handler for individual tracks (mute/unmute)
  const handleTrackPlay = useCallback(async (track: Track) => {
    const newMutedState = !(track.isMuted || false);
    
    // Update track in parent component
    if (onTracksUpdate) {
      const updatedTracks = tracks.map(t => 
        t.id === track.id ? { ...t, isMuted: newMutedState } : t
      );
      onTracksUpdate(updatedTracks);
    }
    
    toast({
      title: newMutedState ? "Track Muted" : "Track Unmuted",
      description: track.name,
    });
  }, [tracks, onTracksUpdate, toast]);

  // Update timeline width
  useEffect(() => {
    if (timelineRef.current) {
      setTimelineWidth(timelineRef.current.offsetWidth);
    }
  }, []);

  const handleTimelineClick = useCallback((event: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const time = snapToGrid(x / pixelsPerSecond);
    
    // If we have a copied clip and ctrl/cmd is held, paste it
    if (copiedClip && (event.ctrlKey || event.metaKey)) {
      pasteClip(time);
    } else {
      // Otherwise seek to the clicked position
      onSeek(time);
    }
  }, [copiedClip, pasteClip, onSeek, snapToGrid, pixelsPerSecond]);

  // Utility functions
  const formatTime = (seconds: number) => {
    const bars = Math.floor(seconds / secondsPerBar);
    const beats = Math.floor((seconds % secondsPerBar) / secondsPerBeat);
    return `${bars + 1}.${beats + 1}`;
  };

  const formatPosition = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getStemColor = (stemType: string) => {
    const colors = {
      drums: 'bg-red-500/20 border-red-500',
      bass: 'bg-blue-500/20 border-blue-500',
      melody: 'bg-green-500/20 border-green-500',
      vocals: 'bg-purple-500/20 border-purple-500',
      other: 'bg-gray-500/20 border-gray-500'
    };
    return colors[stemType as keyof typeof colors] || colors.other;
  };

  // Render bar markers
  const renderBarMarkers = () => {
    const markers = [];
    for (let bar = 0; bar < totalBars; bar++) {
      const x = bar * pixelsPerBar;
      markers.push(
        <div key={`bar-${bar}`} className="absolute h-full z-30 pointer-events-none">
          <div className="w-px h-full bg-white/20 relative" style={{ left: x }}>
            <span className="absolute top-1 left-1 text-xs text-white z-30 bg-gray-900/80 px-1 rounded">
              {bar + 1}
            </span>
          </div>
          {/* Beat markers */}
          {[1, 2, 3].map(beat => (
            <div
              key={`beat-${bar}-${beat}`}
              className="absolute w-px h-full bg-white/10"
              style={{ left: x + beat * pixelsPerBeat }}
            />
          ))}
        </div>
      );
    }
    return markers;
  };

  // Enhanced Waveform Track Component using WaveSurfer.js
  const EnhancedWaveformTrack: React.FC<{
    track: Track;
    clips: AudioClip[];
    trackY: number;
    trackHeight: number;
    trackIndex: number;
  }> = ({ track, clips, trackY, trackHeight, trackIndex }) => {
    const trackClips = clips.filter(clip => clip.trackId === track.id);

    console.log('WaveformTrack for', track.name, ':', {
      trackId: track.id,
      trackClips,
      totalClips: clips.length,
      allClipTrackIds: clips.map(c => c.trackId)
    });

    return (
      <div className="relative w-full h-full">
        {trackClips.map(clip => {
          const clipWidth = (clip.endTime - clip.startTime) * pixelsPerSecond;
          const clipLeft = clip.startTime * pixelsPerSecond;
          const isVisible = clipLeft < timelineWidth && clipLeft + clipWidth > 0;

          console.log('Rendering clip for', track.name, ':', {
            clipId: clip.id,
            startTime: clip.startTime,
            endTime: clip.endTime,
            clipWidth,
            clipLeft,
            pixelsPerSecond,
            trackY,
            trackHeight,
            isVisible
          });

          if (!isVisible) return null;

          return (
            <DraggableClip
              key={clip.id}
              clip={clip}
              currentTime={currentTime}
              isPlaying={isPlaying}
              pixelsPerSecond={pixelsPerSecond}
              trackHeight={trackHeight}
              trackIndex={trackIndex}
              secondsPerBeat={secondsPerBeat}
              onClipMove={moveClip}
              onClipClick={(clipId, event) => {
                const newSelection = new Set(selectedClips);
                if (event.ctrlKey || event.metaKey) {
                  if (newSelection.has(clipId)) {
                    newSelection.delete(clipId);
                  } else {
                    newSelection.add(clipId);
                  }
                } else {
                  newSelection.clear();
                  newSelection.add(clipId);
                }
                setSelectedClips(newSelection);
              }}
              onClipDoubleClick={(clipId) => {
                duplicateClip(clipId);
              }}
              onDuplicateClip={duplicateClip}
              className={selectedClips.has(clip.id) ? 'ring-2 ring-primary' : ''}
            />
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* Audio Bridge - handles all audio engine logic */}
      <AudioBridge
        tracks={tracks.map((t) => {
          const knownDuration = trackDurations.get(t.id) || t.analyzed_duration || t.duration;
          let resolvedBars: number = t.bars ?? 0;
          if (!resolvedBars) {
            if (knownDuration && knownDuration > 0) {
              resolvedBars = Math.max(1, Math.round(knownDuration / secondsPerBar));
            } else {
              resolvedBars = 8; // Ensure minimum 8 bars if unknown
            }
          }
          return { ...t, bars: resolvedBars };
        })}
        clips={audioClips}
        bpm={bpm}
        isPlaying={isPlaying}
        currentTime={currentTime}
        onTick={handleTick}
        onPlayPause={onPlayPause}
        onSeek={onSeek}
      />
      
      <div className="timeline-view h-full flex flex-col bg-black/20"
           onClick={() => setSelectedClips(new Set())}>
        
        {/* Instructions Panel */}
        <div className="bg-black/40 border-b border-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-white">Timeline Controls</h3>
            <BPMSyncIndicator sessionBPM={bpm} />
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>Click: Seek</span>
            <span>Ctrl+Click: Paste Clip</span>
            <span>⧉ Button: Duplicate</span>
            <span>Ctrl+C/V/D: Copy/Paste/Duplicate</span>
            <span>Del: Delete</span>
          </div>
        </div>

        {/* Main Timeline Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Track Names Sidebar */}
          <div className="w-48 bg-black/60 border-r border-white/10 flex flex-col">
            {/* Master Volume */}
            <div className="h-[68px] flex flex-col justify-center p-3 border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-white">Master</span>
                <span className="text-xs text-gray-400">{masterVolume}%</span>
              </div>
              <Slider
                value={[masterVolume]}
                onValueChange={(value) => setMasterVolume(value[0])}
                max={150}
                step={1}
                className="w-full"
              />
            </div>

            {/* Track Controls */}
            {tracks.map((track, index) => {
              console.log('Sidebar track', index, ':', track.name, '(ID:', track.id, ')');
              return (
                <div key={track.id} className="p-3 border-b border-white/10 bg-black/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-white truncate" title={track.name}>
                      {track.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={track.isMuted ? "destructive" : "outline"}
                        className="h-6 w-6 p-0"
                        onClick={() => handleTrackPlay(track)}
                      >
                        {track.isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                        onClick={() => deleteTrack(track.id)}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">Vol</span>
                    <span className="text-xs text-gray-400">{Math.round((track.volume || 1) * 100)}%</span>
                  </div>
                  <Slider
                    value={[Math.round((track.volume || 1) * 100)]}
                    onValueChange={(value) => {
                      if (onTracksUpdate) {
                        const updatedTracks = tracks.map(t => 
                          t.id === track.id ? { ...t, volume: value[0] / 100 } : t
                        );
                        onTracksUpdate(updatedTracks);
                      }
                    }}
                    max={150}
                    step={1}
                    className="w-full"
                  />
                  <Badge variant="outline" className="text-xs mt-1">
                    {track.stem_type}
                  </Badge>
                </div>
              );
            })}
          </div>

          {/* Timeline Area */}
          <div className="flex-1 relative overflow-x-auto" ref={timelineRef}>
            {/* Ruler */}
            <div className="h-12 bg-black/40 border-b border-white/10 relative">
              {renderBarMarkers()}
              <div className="absolute top-6 left-2 text-xs text-gray-400">
                Position: {formatPosition(currentTime)} | Bar: {formatTime(currentTime)}
              </div>
            </div>

            {/* Playhead */}
            <div
              className="absolute top-12 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
              style={{ left: (currentTime % sessionDuration) * pixelsPerSecond }}
            >
              <div className="absolute -top-2 -left-1 w-3 h-3 bg-primary rotate-45" />
            </div>

            {/* Master Output Visualization */}
            <div className="h-12 bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-white/10 relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-gray-400">Master Output</span>
              </div>
            </div>

            {/* Timeline with Tracks */}
            <div className="relative" onClick={handleTimelineClick}>
              {tracks.map((track, index) => {
                const trackY = index * 72;
                const trackHeight = 68;
                
                console.log('Rendering track', index, ':', track.name, '(ID:', track.id, ')');
                
                return (
                  <div
                    key={track.id}
                    className="relative border-b border-white/10"
                    style={{ height: trackHeight }}
                  >
                    <EnhancedWaveformTrack
                      track={track}
                      clips={audioClips}
                      trackY={trackY}
                      trackHeight={trackHeight}
                      trackIndex={index}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
