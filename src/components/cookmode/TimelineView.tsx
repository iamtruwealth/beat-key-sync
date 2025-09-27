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
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const blobSrcTriedRef = useRef<Set<string>>(new Set());
  const [trackDurations, setTrackDurations] = useState<Map<string, number>>(new Map());
  const [masterVolume, setMasterVolume] = useState(100);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [copiedClip, setCopiedClip] = useState<AudioClip | null>(null);
  const { toast } = useToast();

  // Metronome state
  const audioContextRef = useRef<AudioContext | null>(null);
  const metronomeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const baseStartAudioCtxTimeRef = useRef(0);
  const baseStartTimelineTimeRef = useRef(0);
  const nextBeatIndexRef = useRef(0);
  const prevTimeRef = useRef(0);

  // Calculate timing constants with precise BPM
  const secondsPerBeat = 60 / bpm; // Precise: 60 seconds / beats per minute
  const beatsPerBar = 4;
  const secondsPerBar = secondsPerBeat * beatsPerBar;
  
  // Calculate session length based on the LAST ending clip (not longest)
  const lastClipEndTime = Math.max(
    ...(audioClips.length > 0 ? audioClips.map(c => c.endTime) : []),
    ...tracks.map(track => {
      // Prefer actual audio duration to infer bars when not explicitly provided
      const knownDuration = trackDurations.get(track.id) || track.analyzed_duration || track.duration;
      if (knownDuration && knownDuration > 0) {
        const estimatedBars = Math.max(1, Math.round(knownDuration / secondsPerBar));
        return estimatedBars * secondsPerBar;
      }
      const clipBars = track.bars || 4; // sensible default for loops
      return clipBars * secondsPerBar; // Default clip if no clips exist yet
    }),
    4 * secondsPerBar // Minimum 4 bars
  );
  
  const sessionDuration = lastClipEndTime; // Session ends when the last clip ends
  const totalBars = Math.ceil(sessionDuration / secondsPerBar);
  
  const pixelsPerSecond = 40;
  const pixelsPerBeat = pixelsPerSecond * secondsPerBeat;
  const pixelsPerBar = pixelsPerBeat * beatsPerBar;

  // Initialize audio context for metronome
  useEffect(() => {
    if (metronomeEnabled) {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } else if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    }
    return () => {
      // Do not close context on toggle; reuse to keep clock stable
    };
  }, [metronomeEnabled]);

  // Metronome click function (scheduled)
  const playMetronomeClick = useCallback((when: number, isDownbeat: boolean = false) => {
    if (!audioContextRef.current || !metronomeEnabled) return;

    const audioContext = audioContextRef.current;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.frequency.setValueAtTime(isDownbeat ? 1100 : 800, when);
    osc.type = 'square';

    const peak = 0.08;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peak, when + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0008, when + 0.08);

    osc.start(when);
    osc.stop(when + 0.1);
  }, [metronomeEnabled]);

  // Metronome scheduler using AudioContext clock (tight sync)
  useEffect(() => {
    if (!metronomeEnabled || !isPlaying) {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
        metronomeIntervalRef.current = null;
      }
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } else if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const ac = audioContextRef.current;

    // Align scheduler to current playhead
    baseStartAudioCtxTimeRef.current = ac.currentTime;
    baseStartTimelineTimeRef.current = currentTime;
    nextBeatIndexRef.current = Math.floor(currentTime / secondsPerBeat);

    const lookaheadMs = 25; // how often we check
    const scheduleAheadTime = 0.15; // schedule this far ahead (sec)

    metronomeIntervalRef.current = setInterval(() => {
      const now = ac.currentTime;
      // schedule all beats up to now + scheduleAheadTime
      while (true) {
        const beatIndex = nextBeatIndexRef.current;
        const beatTimeTimeline = beatIndex * secondsPerBeat; // seconds from timeline 0
        const when = baseStartAudioCtxTimeRef.current + (beatTimeTimeline - baseStartTimelineTimeRef.current);
        if (when <= now + scheduleAheadTime) {
          const isDownbeat = (beatIndex % beatsPerBar) === 0;
          playMetronomeClick(when, isDownbeat);
          nextBeatIndexRef.current = beatIndex + 1;
        } else {
          break;
        }
      }
    }, lookaheadMs);

    return () => {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
        metronomeIntervalRef.current = null;
      }
    };
  }, [isPlaying, metronomeEnabled, secondsPerBeat, beatsPerBar, currentTime, playMetronomeClick]);

  // Realign scheduler on large seeks/jumps
  useEffect(() => {
    if (!isPlaying || !metronomeEnabled || !audioContextRef.current) {
      prevTimeRef.current = currentTime;
      return;
    }
    const delta = Math.abs(currentTime - prevTimeRef.current);
    if (delta > secondsPerBeat * 0.75) {
      const ac = audioContextRef.current;
      baseStartAudioCtxTimeRef.current = ac.currentTime;
      baseStartTimelineTimeRef.current = currentTime;
      nextBeatIndexRef.current = Math.floor(currentTime / secondsPerBeat);
    }
    prevTimeRef.current = currentTime;
  }, [currentTime, isPlaying, metronomeEnabled, secondsPerBeat]);

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
        // Prefer computed bars from actual duration if bars not provided
        const knownDuration = trackDurations.get(track.id) || track.analyzed_duration || track.duration;
        let resolvedBars: number = track.bars ?? 0;
        if (!resolvedBars) {
          if (knownDuration && knownDuration > 0) {
            resolvedBars = Math.max(1, Math.round(knownDuration / secondsPerBar));
          } else {
            resolvedBars = 4; // sensible default for typical loops
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
        console.log('Creating clip for track:', track.name, 'Bars:', resolvedBars, 'Duration:', clipDuration, 'Known duration:', knownDuration, 'Clip:', clip);
        return clip;
      });
      
      // Only update if clips actually changed (including duration updates)
      const clipsChanged =
        initialClips.length !== audioClips.length ||
        initialClips.some((newClip) => {
          const existing = audioClips.find((e) => e.id === newClip.id);
          if (!existing) return true;
          return (
            existing.startTime !== newClip.startTime ||
            existing.endTime !== newClip.endTime ||
            existing.originalTrack.id !== newClip.originalTrack.id
          );
        });
      
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
    
    // Clean up audio element
    const audioElement = audioElementsRef.current.get(trackId);
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
      audioElementsRef.current.delete(trackId);
    }
    
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
          // Only log once when first loaded, not on every canplay event
          if (!audio.hasAttribute('data-initialized')) {
            console.log('Audio loaded:', track.name);
            audio.setAttribute('data-initialized', 'true');
            
            // Sync with current playback state only on initial load
            if (isPlaying) {
              audio.currentTime = currentTime;
              audio.play().catch(error => {
                console.error('Error starting playback:', error);
              });
            }
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

  // Sync playback state with main controls - precise BPM timing with simultaneous start
  useEffect(() => {
    console.log('Timeline syncing playback state:', { isPlaying, currentTime, bpm, secondsPerBeat, audioElementsCount: audioElementsRef.current.size });
    
    // Collect all audio elements that need to start/stop simultaneously
    const audioToStart: { audio: HTMLAudioElement; trackId: string; clipTime: number }[] = [];
    const audioToStop: { audio: HTMLAudioElement; trackId: string }[] = [];
    
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
          // Calculate precise clip time for BPM sync
          const activeClip = activeClips[0];
          const clipTime = Math.max(0, currentTime - activeClip.startTime);
          audioToStart.push({ audio, trackId, clipTime });
        } else if (!shouldPlay && !audio.paused) {
          audioToStop.push({ audio, trackId });
        }
        
        // Handle loop restart - reset all audio to beginning when currentTime is near zero
        if (currentTime < 0.1 && audio.currentTime > 0.5) {
          console.log('Loop restart detected - resetting audio for track:', trackId);
          audio.currentTime = 0;
        }
      } catch (error) {
        console.error('Error syncing audio playback:', error);
      }
    });
    
    // Stop audio that should be stopped
    audioToStop.forEach(({ audio, trackId }) => {
      console.log('Pausing playback for track:', trackId);
      audio.pause();
    });
    
    // Start all audio simultaneously for perfect BPM sync
    if (audioToStart.length > 0) {
      console.log('Starting simultaneous playback for tracks:', audioToStart.map(a => a.trackId));
      
      // Set all currentTime values first (faster than individual play() calls)
      audioToStart.forEach(({ audio, clipTime }) => {
        audio.currentTime = clipTime;
      });
      
      // Start all audio elements simultaneously using Promise.all for perfect sync
      const playPromises = audioToStart.map(({ audio, trackId, clipTime }) => {
        return audio.play()
          .then(() => {
            console.log('Audio started successfully for:', trackId, 'at time:', clipTime);
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
      });
      
      // Wait for all to start (but don't block the effect)
      Promise.all(playPromises).then(() => {
        console.log('All audio tracks started simultaneously');
      });
    }
  }, [isPlaying, currentTime, audioClips, bpm, secondsPerBeat, toast]);

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

  // Automatic loop logic - loop when reaching end of longest clip
  useEffect(() => {
    // Always loop at the end of the session (when longest clip ends)
    if (currentTime >= sessionDuration) {
      console.log(`Auto-looping: currentTime ${currentTime}s >= sessionDuration ${sessionDuration}s`);
      onSeek(0); // Go back to zero and restart
    }
  }, [currentTime, sessionDuration, onSeek]);

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
      onSeek(Math.max(0, Math.min(time, sessionDuration)));
    }
    
    // Clear selection if clicking on empty space
    if (!event.ctrlKey && !event.metaKey) {
      setSelectedClips(new Set());
    }
  }, [pixelsPerSecond, sessionDuration, onSeek, snapToGrid, copiedClip, pasteClip]);

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
    // Account for master track space (84px) + this track's position
    const masterTrackHeight = 84;
    const trackY = masterTrackHeight + (index - 1) * trackHeight; // index-1 because we're already offset by +1
    const trackClips = audioClips.filter(clip => clip.trackId === track.id);
    
    console.log(`WaveformTrack for ${track.name}:`, {
      trackId: track.id,
      trackClips: trackClips,
      totalClips: audioClips.length,
      allClipTrackIds: audioClips.map(c => c.trackId)
    });

    return (
      <div 
        className="absolute overflow-hidden" 
        style={{ 
          top: trackY,
          height: trackHeight,
          width: '100%'
        }}
      >
        {/* Track background with proper bounds */}
        <div 
          className="absolute inset-0 border-b border-border/10" 
          style={{ 
            top: 0,
            height: trackHeight,
            left: 0,
            right: 0 
          }} 
        />
        
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

          // Generate waveform bars for visualization - show waveform within clip's bar duration
          let waveformBars: number[] = [];
          const clipDuration = clip.endTime - clip.startTime;
          const clipBars = Math.max(1, Math.round(clipDuration / secondsPerBar));
          
          if (waveformData?.peaks) {
            // The waveform should fill the entire clip (which is based on bars)
            const targetBars = Math.max(Math.floor(clipWidth / 8), clipBars * 4); // 4 waveform bars per musical bar
            waveformBars = generateWaveformBars(waveformData.peaks, targetBars);
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
                top: 8, // position within this track lane only
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
                      {clipBars} bars ({clipDuration.toFixed(1)}s)
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

              {/* Clip actions (visible on hover) - high z-index to stay on top */}
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-20 bg-background/90 rounded p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 text-xs hover:bg-primary/20"
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
                  className="h-4 w-4 p-0 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete clip "${clip.originalTrack.name}"?`)) {
                      deleteClip(clip.id);
                    }
                  }}
                  title="Delete Clip (Del)"
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

              {/* Clip name - moved to bottom to avoid covering controls */}
              <div className="absolute bottom-1 left-1 z-10">
                <Badge variant="outline" className="text-xs bg-background/90 text-foreground border-primary/30 px-1 py-0">
                  {clip.originalTrack.name.length > 15 ? 
                    `${clip.originalTrack.name.substring(0, 15)}...` : 
                    clip.originalTrack.name
                  }
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
                  className="h-[68px] border-b border-border/20 p-2 flex flex-col justify-center group cursor-pointer hover:bg-card/20 transition-colors relative"
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
                    <div className="flex items-center gap-1">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete track "${track.name}"? This will remove the track and all its clips from the session.`)) {
                            deleteTrack(track.id);
                          }
                        }}
                        title="Delete Track"
                      >
                        ×
                      </Button>
                    </div>
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
                height: 84 + (tracks.length * 68), // Master track (84px) + user tracks (68px each)
                minHeight: 200,
                width: totalBars * pixelsPerBar
              }}
              onClick={handleTimelineClick}
            >
              {/* Session duration indicator */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/60 z-5"
                style={{ left: sessionDuration * pixelsPerSecond }}
              >
                <div className="absolute -top-6 -left-8 text-xs text-yellow-400 font-mono">
                  END ({totalBars} bars)
                </div>
              </div>

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
                  width: sessionDuration * pixelsPerSecond,
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