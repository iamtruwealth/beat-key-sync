import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onTracksUpdate?: (tracks: Track[]) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  tracks,
  isPlaying,
  currentTime,
  bpm,
  onPlayPause,
  onSeek,
  onTracksUpdate
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(32);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const blobSrcTriedRef = useRef<Set<string>>(new Set());
  const [trackDurations, setTrackDurations] = useState<Map<string, number>>(new Map());
  const [masterVolume, setMasterVolume] = useState(100);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [copiedClip, setCopiedClip] = useState<AudioClip | null>(null);
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

  // Initialize audio clips from tracks - ensure proper positioning
  useEffect(() => {
    console.log('Checking clips initialization:', { 
      audioClipsLength: audioClips.length, 
      tracksLength: tracks.length,
      trackDurations: Array.from(trackDurations.entries()),
      trackNames: tracks.map(t => t.name)
    });
    
    // Always recreate clips when tracks change to ensure all tracks get clips
    if (tracks.length > 0) {
      const initialClips: AudioClip[] = tracks.map(track => {
        const duration = trackDurations.get(track.id) || track.analyzed_duration || track.duration || 60;
        const clip = {
          id: `${track.id}-clip-0`,
          trackId: track.id,
          startTime: 0, // Always start at beginning
          endTime: duration,
          originalTrack: track
        };
        console.log('Creating clip for track:', track.name, 'ID:', track.id, 'Clip:', clip);
        return clip;
      });
      
      // Only update if clips actually changed
      const clipsChanged = initialClips.length !== audioClips.length || 
        initialClips.some(clip => !audioClips.find(existing => existing.id === clip.id));
      
      if (clipsChanged) {
        console.log('Updating audio clips - old:', audioClips, 'new:', initialClips);
        setAudioClips(initialClips);
      }
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

  // Sync playback state with main controls - improved for clip system
  useEffect(() => {
    console.log('Timeline syncing playback state:', { isPlaying, audioElementsCount: audioElementsRef.current.size });
    audioElementsRef.current.forEach((audio, trackId) => {
      try {
        if (!audio.src) return;
        
        // Find active clips for this track at current time
        const activeClips = audioClips.filter(clip => 
          clip.trackId === trackId && 
          currentTime >= clip.startTime && 
          currentTime < clip.endTime
        );
        
        const shouldPlay = isPlaying && activeClips.length > 0;
        
        if (shouldPlay && audio.paused) {
          console.log('Starting playback for track:', trackId);
          
          // Set audio time relative to clip start
          const activeClip = activeClips[0]; // Use first active clip
          const clipTime = currentTime - activeClip.startTime;
          audio.currentTime = clipTime;
          
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => console.log('Audio started successfully for:', trackId))
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
        } else if (!shouldPlay && !audio.paused) {
          console.log('Pausing playback for track:', trackId);
          audio.pause();
        }
      } catch (error) {
        console.error('Error syncing audio playback:', error);
      }
    });
  }, [isPlaying, currentTime, audioClips, toast]);

  // Sync current time with clip playback
  useEffect(() => {
    audioElementsRef.current.forEach((audio, trackId) => {
      // Find active clips for this track at current time
      const activeClips = audioClips.filter(clip => 
        clip.trackId === trackId && 
        currentTime >= clip.startTime && 
        currentTime < clip.endTime
      );
      
      if (activeClips.length > 0) {
        const activeClip = activeClips[0];
        const clipTime = currentTime - activeClip.startTime;
        
        // Only seek if there's a significant difference
        if (Math.abs(audio.currentTime - clipTime) > 1.0) {
          console.log(`Seeking track ${trackId} from ${audio.currentTime} to ${clipTime} (clip time)`);
          audio.currentTime = clipTime;
        }
      } else if (!audio.paused) {
        // No active clip, pause audio
        console.log(`No active clip for track ${trackId}, pausing`);
        audio.pause();
      }
    });
  }, [currentTime, audioClips]);

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

  // Update track volumes and mute states with master volume
  useEffect(() => {
    tracks.forEach(track => {
      const audio = audioElementsRef.current.get(track.id);
      if (audio) {
        const trackVolume = track.volume !== undefined ? track.volume : 1;
        const baseVolume = trackVolume * (masterVolume / 100);
        audio.volume = baseVolume;
        audio.muted = track.isMuted || false;
        // Update base volume for master fader control
        audio.setAttribute('data-base-volume', trackVolume.toString());
        
        // Also check if track should be stopped due to duration
        const actualDuration = trackDurations.get(track.id) || track.analyzed_duration || track.duration || audio.duration;
        if (actualDuration && audio.currentTime >= actualDuration && !audio.paused) {
          console.log(`Stopping track ${track.name} - exceeded duration`);
          audio.pause();
          audio.currentTime = actualDuration;
        }
      }
    });
  }, [tracks, trackDurations, masterVolume]);

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
    const time = snapToGrid(x / pixelsPerSecond);
    
    // If we have a copied clip and ctrl/cmd is held, paste it
    if (copiedClip && (event.ctrlKey || event.metaKey)) {
      pasteClip(time);
    } else {
      // Otherwise seek to that position
      onSeek(Math.max(0, Math.min(time, maxDuration)));
    }
    
    // Clear selection if clicking on empty space
    if (!event.ctrlKey && !event.metaKey) {
      setSelectedClips(new Set());
    }
  }, [pixelsPerSecond, maxDuration, onSeek, snapToGrid, copiedClip, pasteClip]);

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
          <span className="absolute top-1 left-1 text-xs text-muted-foreground font-mono">
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
    const trackY = index * trackHeight;
    const trackClips = audioClips.filter(clip => clip.trackId === track.id);
    
    console.log(`WaveformTrack for ${track.name}:`, {
      trackId: track.id,
      trackClips: trackClips,
      totalClips: audioClips.length,
      allClipTrackIds: audioClips.map(c => c.trackId)
    });

    return (
      <div className="relative" style={{ height: trackHeight }}>
        {trackClips.length === 0 ? (
          // Fallback: create temporary clip if none exist
          <div className="text-red-500 p-2 text-xs">
            No clips found for {track.name} (ID: {track.id})
            <br />
            Track clips: {trackClips.length}, Total clips: {audioClips.length}
          </div>
        ) : (
          trackClips.map((clip) => {
          const { waveformData, isLoading } = useWaveformGenerator({ 
            audioUrl: clip.originalTrack.file_url,
            targetWidth: 500 
          });

          const clipWidth = (clip.endTime - clip.startTime) * pixelsPerSecond;
          const clipLeft = clip.startTime * pixelsPerSecond;
          const isSelected = selectedClips.has(clip.id);

          console.log(`Rendering clip for ${clip.originalTrack.name}:`, {
            clipId: clip.id,
            startTime: clip.startTime,
            endTime: clip.endTime,
            clipWidth,
            clipLeft,
            pixelsPerSecond,
            trackY,
            trackHeight,
            isVisible: clipWidth > 0 && clipLeft >= 0
          });

          // Generate waveform bars for visualization - only show actual audio duration
          let waveformBars: number[] = [];
          const totalDuration = trackDurations.get(track.id) || clip.originalTrack.analyzed_duration || clip.originalTrack.duration || 0;
          
          // Visual width defaults to the full clip, but we clamp to actual audio if known
          let visualWidth = clipWidth;
          let actualAudioInClip = clip.endTime - clip.startTime;
          if (totalDuration > 0) {
            actualAudioInClip = Math.max(0, Math.min(clip.endTime, totalDuration) - clip.startTime);
            visualWidth = Math.max(0, Math.min(clipWidth, actualAudioInClip * pixelsPerSecond));
          }
          
          if (waveformData?.peaks && totalDuration > 0 && actualAudioInClip > 0) {
            // Slice waveform data to match the actual audio portion inside the clip window
            const startRatio = clip.startTime / totalDuration;
            const endRatio = Math.min((clip.startTime + actualAudioInClip) / totalDuration, 1);
            const startIndex = Math.floor(startRatio * waveformData.peaks.length);
            const endIndex = Math.ceil(endRatio * waveformData.peaks.length);
            const clippedPeaks = waveformData.peaks.slice(startIndex, endIndex);
            
            const targetBars = Math.max(Math.floor(visualWidth / 8), 16);
            waveformBars = generateWaveformBars(clippedPeaks, targetBars);
          }

          return (
            <div
              key={clip.id}
              className={`absolute bg-gradient-to-r border rounded overflow-hidden cursor-pointer group transition-all ${
                isSelected 
                  ? 'from-neon-cyan/40 to-electric-blue/60 border-neon-cyan shadow-neon-cyan shadow-[0_0_10px]' 
                  : 'from-primary/20 to-primary/40 border-primary/30 hover:border-primary/50'
              }`}
              style={{
                top: trackY + 8,
                left: clipLeft,
                width: clipWidth,
                height: trackHeight - 16,
                zIndex: 10,
                minWidth: '20px',
              }}
              title={`${clip.originalTrack.name} - Click to select, Double-click to duplicate`}
              onClick={(e) => {
                e.stopPropagation();
                console.log('Clip clicked:', clip.originalTrack.name, 'Clip ID:', clip.id);
                setSelectedClips(prev => {
                  const newSet = new Set(prev);
                  if (e.ctrlKey || e.metaKey) {
                    if (newSet.has(clip.id)) {
                      newSet.delete(clip.id);
                      console.log('Removed from selection:', clip.id);
                    } else {
                      newSet.add(clip.id);
                      console.log('Added to selection:', clip.id);
                    }
                  } else {
                    newSet.clear();
                    newSet.add(clip.id);
                    console.log('Single selection:', clip.id);
                  }
                  console.log('New selection:', Array.from(newSet));
                  return newSet;
                });
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                console.log('Right-click on clip:', clip.originalTrack.name, 'Clip ID:', clip.id);
                setSelectedClips(new Set([clip.id]));
                // Simple context menu using confirm dialogs for now
                const action = prompt('Action: (c)opy, (d)uplicate, (delete)');
                console.log('Context menu action:', action);
                switch(action?.toLowerCase()) {
                  case 'c':
                  case 'copy':
                    copyClip(clip.id);
                    break;
                  case 'd':
                  case 'duplicate':
                    duplicateClip(clip.id);
                    break;
                  case 'delete':
                    deleteClip(clip.id);
                    break;
                }
              }}
              onDoubleClick={() => {
                console.log('Double-click on clip:', clip.originalTrack.name, 'Clip ID:', clip.id);
                duplicateClip(clip.id);
              }}
            >
              {/* Waveform visualization */}
              <div className="h-full p-1 flex items-center overflow-hidden">
                {isLoading ? (
                  <div className="flex-1 h-8 bg-gradient-to-r from-neon-cyan/20 to-electric-blue/20 rounded flex items-center justify-center">
                    <span className="text-xs text-foreground/60">Loading...</span>
                  </div>
                ) : waveformBars.length > 0 ? (
                  <div className="flex-1 h-8 flex items-end gap-px overflow-hidden">
                    {waveformBars.map((bar, i) => (
                      <div
                        key={i}
                        className="bg-gradient-to-t from-neon-cyan/60 to-electric-blue/60 rounded-sm flex-1 min-w-[1px]"
                        style={{ height: `${Math.max(bar * 100, 2)}%` }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 h-8 bg-gradient-to-r from-neon-cyan/20 to-electric-blue/20 rounded flex items-center justify-center">
                    <span className="text-xs text-foreground/60">
                      {(Math.max(0, Math.min(clip.endTime, (clip.startTime + totalDuration)) - clip.startTime)).toFixed(1)}s
                    </span>
                  </div>
                )}
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute inset-0 border-2 border-neon-cyan rounded pointer-events-none">
                  <div className="absolute -top-6 left-0 bg-neon-cyan text-black text-xs px-1 rounded">
                    {clip.originalTrack.name}
                  </div>
                </div>
              )}

              {/* Clip actions (visible on hover) */}
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateClip(clip.id);
                  }}
                  title="Duplicate (Ctrl+D)"
                >
                  ⧉
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteClip(clip.id);
                  }}
                  title="Delete (Del)"
                >
                  ×
                </Button>
              </div>

              {/* Mute/Solo overlay */}
              {(track.isMuted || (tracks.some(t => t.isSolo) && !track.isSolo)) && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">
                    {track.isMuted ? 'MUTED' : 'SOLO OFF'}
                  </span>
                </div>
              )}

              {/* Clip name */}
              <div className="absolute top-1 left-1">
                <Badge variant="outline" className="text-xs bg-background/80 text-foreground">
                  {clip.originalTrack.name}
                </Badge>
              </div>
            </div>
          );
        })
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-background/50">
      {/* Instructions Panel */}
      <div className="px-4 py-2 bg-card/10 border-b border-border/30 text-xs text-muted-foreground">
        <span className="font-medium">Timeline Controls:</span> Click to select clips • Double-click to duplicate • Right-click for menu • 
        <span className="font-medium">Shortcuts:</span> Ctrl+C copy • Ctrl+V paste • Ctrl+D duplicate • Del delete • Ctrl+Click timeline to paste
      </div>

      {/* Main Timeline Area */}
      <div className="flex-1 relative overflow-auto">
        <div className="flex">
          {/* Track names sidebar */}
          <div className="w-48 flex-shrink-0 bg-card/10 border-r border-border/30">
            <div className="h-8"></div> {/* Spacer for ruler */}
            
            {/* Master Track */}
            <div className="h-20 border-b-2 border-neon-cyan/30 p-2 flex flex-col justify-center bg-gradient-to-r from-neon-cyan/10 to-electric-blue/10">
              <div className="text-xs font-bold text-neon-cyan mb-2 flex items-center gap-2">
                <Volume2 className="w-3 h-3" />
                MASTER
              </div>
              <div className="flex items-center gap-2">
                <Volume2 className="w-3 h-3 text-neon-cyan" />
                <Slider
                  value={[masterVolume]}
                  onValueChange={(value) => setMasterVolume(value[0])}
                  max={100}
                  min={0}
                  step={1}
                  className="flex-1 h-2"
                />
                <span className="text-xs text-neon-cyan font-mono w-8">
                  {masterVolume}
                </span>
              </div>
            </div>

            {tracks.map((track, index) => {
              console.log(`Sidebar track ${index}: ${track.name} (ID: ${track.id})`);
              return (
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
              );
            })}
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
                height: (tracks.length * 68) + 84, // Extra height for master track
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

              {/* Master track visual */}
              <div
                className="absolute bg-gradient-to-r from-neon-cyan/20 to-electric-blue/20 border-2 border-neon-cyan/40 rounded overflow-hidden"
                style={{
                  top: 8,
                  left: 0,
                  width: maxDuration * pixelsPerSecond,
                  height: 64
                }}
              >
                <div className="h-full p-2 flex items-center justify-center">
                  <div className="text-sm font-bold text-neon-cyan flex items-center gap-2">
                    <Volume2 className="w-4 h-4" />
                    MASTER OUTPUT
                  </div>
                </div>
              </div>

              {/* Track waveforms */}
              {tracks.map((track, index) => {
                console.log(`Rendering track ${index}: ${track.name} (ID: ${track.id})`);
                return (
                  <WaveformTrack 
                    key={track.id}
                    track={track} 
                    index={index + 1} // Offset by 1 for master track
                    pixelsPerSecond={pixelsPerSecond}
                    trackHeight={68}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};