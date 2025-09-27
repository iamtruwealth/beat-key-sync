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
  const [trackDurations, setTrackDurations] = useState<Map<string, number>>(new Map());
  const [masterVolume, setMasterVolume] = useState(100);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [copiedClip, setCopiedClip] = useState<AudioClip | null>(null);
  const { toast } = useToast();

  // Web Audio API state
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const activeSourcesRef = useRef<Map<string, AudioBufferSourceNode[]>>(new Map());
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const masterGainRef = useRef<GainNode | null>(null);
  const audioClockStartTimeRef = useRef<number>(0);
  const timelineClockStartTimeRef = useRef<number>(0);
  
  // Metronome state (reference only)
  const metronomeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const nextBeatIndexRef = useRef(0);
  const prevTimeRef = useRef(0);

  // Calculate timing constants with precise BPM (10-250 BPM support)
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

  // Initialize audio context and master gain
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create master gain node
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.connect(audioContextRef.current.destination);
      masterGainRef.current.gain.setValueAtTime(masterVolume / 100, audioContextRef.current.currentTime);
    } else if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  // Load audio buffers for tracks
  useEffect(() => {
    tracks.forEach(async (track) => {
      if (!audioBuffersRef.current.has(track.id) && track.file_url && audioContextRef.current) {
        try {
          console.log('Loading audio buffer for track:', track.name);
          const response = await fetch(track.file_url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
          
          audioBuffersRef.current.set(track.id, audioBuffer);
          setTrackDurations(prev => new Map(prev.set(track.id, audioBuffer.duration)));
          
          // Create gain node for this track
          if (!gainNodesRef.current.has(track.id)) {
            const gainNode = audioContextRef.current!.createGain();
            gainNode.connect(masterGainRef.current!);
            gainNode.gain.setValueAtTime(track.volume || 1, audioContextRef.current!.currentTime);
            gainNodesRef.current.set(track.id, gainNode);
          }
          
          console.log('Audio buffer loaded for:', track.name, 'Duration:', audioBuffer.duration);
        } catch (error) {
          console.error('Failed to load audio for track:', track.name, error);
          toast({
            title: "Audio Error",
            description: `Failed to load audio for ${track.name}`,
            variant: "destructive"
          });
        }
      }
    });
  }, [tracks, toast]);

  // Stop all audio sources
  const stopAllSources = useCallback(() => {
    activeSourcesRef.current.forEach((sources) => {
      sources.forEach(source => {
        try {
          source.stop();
        } catch (e) {
          // Source might already be stopped
        }
      });
    });
    activeSourcesRef.current.clear();
  }, []);

  // Calculate precise timing for bar-aligned playback
  const getBarAlignedTime = useCallback((clipStartTime: number, bufferDuration: number, currentPlayTime: number) => {
    if (!audioContextRef.current) return { when: 0, offset: 0 };
    
    const barsInBuffer = Math.ceil(bufferDuration / secondsPerBar);
    const totalLoopDuration = barsInBuffer * secondsPerBar;
    
    // Find where we are in the clip's timeline
    const timeIntoClip = currentPlayTime - clipStartTime;
    const loopPosition = ((timeIntoClip % totalLoopDuration) + totalLoopDuration) % totalLoopDuration;
    
    return {
      when: audioContextRef.current.currentTime,
      offset: loopPosition
    };
  }, [secondsPerBar]);

  // Schedule audio clip to play at precise time
  const scheduleClipPlayback = useCallback((clip: AudioClip, startWhen: number, startOffset: number = 0) => {
    if (!audioContextRef.current) return;
    
    const audioBuffer = audioBuffersRef.current.get(clip.originalTrack.id);
    const gainNode = gainNodesRef.current.get(clip.originalTrack.id);
    
    if (!audioBuffer || !gainNode) return;
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);
    
    // Calculate bar-aligned duration
    const barsInBuffer = Math.ceil(audioBuffer.duration / secondsPerBar);
    const loopDuration = barsInBuffer * secondsPerBar;
    
    // Apply mute/solo logic
    const trackVolume = clip.originalTrack.volume || 1;
    const isMuted = clip.originalTrack.isMuted || false;
    const hasSolo = tracks.some(t => t.isSolo);
    const shouldHear = !isMuted && (!hasSolo || clip.originalTrack.isSolo);
    
    gainNode.gain.setValueAtTime(shouldHear ? trackVolume : 0, startWhen);
    
    // Schedule looped playback
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = Math.min(audioBuffer.duration, loopDuration);
    
    source.start(startWhen, startOffset);
    
    // Store the source for cleanup
    if (!activeSourcesRef.current.has(clip.id)) {
      activeSourcesRef.current.set(clip.id, []);
    }
    activeSourcesRef.current.get(clip.id)!.push(source);
    
    console.log('Scheduled clip:', clip.originalTrack.name, 'when:', startWhen, 'offset:', startOffset, 'loop duration:', loopDuration);
  }, [secondsPerBar, tracks]);

  // Main audio playback control
  useEffect(() => {
    if (!audioContextRef.current) return;
    
    if (isPlaying) {
      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      // Set timing reference
      audioClockStartTimeRef.current = audioContextRef.current.currentTime;
      timelineClockStartTimeRef.current = currentTime;
      
      // Schedule all active clips
      audioClips.forEach(clip => {
        // Only play clips that are active at current time
        if (currentTime >= clip.startTime && currentTime < clip.endTime) {
          const { when, offset } = getBarAlignedTime(clip.startTime, trackDurations.get(clip.originalTrack.id) || 0, currentTime);
          scheduleClipPlayback(clip, when, offset);
        }
      });
    } else {
      stopAllSources();
    }
    
    return () => {
      if (!isPlaying) {
        stopAllSources();
      }
    };
  }, [isPlaying, currentTime, audioClips, getBarAlignedTime, scheduleClipPlayback, stopAllSources, trackDurations]);

  // Update track volumes and mute/solo states
  useEffect(() => {
    tracks.forEach(track => {
      const gainNode = gainNodesRef.current.get(track.id);
      if (gainNode && audioContextRef.current) {
        const trackVolume = track.volume || 1;
        const isMuted = track.isMuted || false;
        const hasSolo = tracks.some(t => t.isSolo);
        const shouldHear = !isMuted && (!hasSolo || track.isSolo);
        
        gainNode.gain.setValueAtTime(
          shouldHear ? trackVolume : 0, 
          audioContextRef.current.currentTime
        );
      }
    });
  }, [tracks]);

  // Update master volume
  useEffect(() => {
    if (masterGainRef.current && audioContextRef.current) {
      masterGainRef.current.gain.setValueAtTime(
        masterVolume / 100, 
        audioContextRef.current.currentTime
      );
    }
  }, [masterVolume]);

  // Metronome reference (BPM 10-250 support)
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

  // Metronome scheduler (reference only, not controlling audio precision)
  useEffect(() => {
    if (!metronomeEnabled || !isPlaying || !audioContextRef.current) {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
        metronomeIntervalRef.current = null;
      }
      return;
    }

    const ac = audioContextRef.current;
    nextBeatIndexRef.current = Math.floor(currentTime / secondsPerBeat);

    const lookaheadMs = 25;
    const scheduleAheadTime = 0.15;

    metronomeIntervalRef.current = setInterval(() => {
      const now = ac.currentTime;
      const timelineElapsed = now - audioClockStartTimeRef.current;
      const currentTimelineTime = timelineClockStartTimeRef.current + timelineElapsed;
      
      while (true) {
        const beatIndex = nextBeatIndexRef.current;
        const beatTimeTimeline = beatIndex * secondsPerBeat;
        const whenToPlay = ac.currentTime + (beatTimeTimeline - currentTimelineTime);
        
        if (whenToPlay <= now + scheduleAheadTime && beatTimeTimeline >= currentTimelineTime) {
          const isDownbeat = (beatIndex % beatsPerBar) === 0;
          playMetronomeClick(whenToPlay, isDownbeat);
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
    
    // Clean up audio resources
    const gainNode = gainNodesRef.current.get(trackId);
    if (gainNode) {
      gainNode.disconnect();
      gainNodesRef.current.delete(trackId);
    }
    
    audioBuffersRef.current.delete(trackId);
    
    // Stop any active sources for this track
    activeSourcesRef.current.forEach((sources, clipId) => {
      const clip = audioClips.find(c => c.id === clipId);
      if (clip && clip.trackId === trackId) {
        sources.forEach(source => {
          try {
            source.stop();
          } catch (e) {
            // Source might already be stopped
          }
        });
        activeSourcesRef.current.delete(clipId);
      }
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

  // Handle track volume/mute toggle
  const handleTrackPlay = useCallback(async (track: Track) => {
    const updatedTracks = tracks.map(t => 
      t.id === track.id ? { ...t, isMuted: !t.isMuted } : t
    );
    
    if (onTracksUpdate) {
      onTracksUpdate(updatedTracks);
    }
    
    toast({
      title: track.isMuted ? "Track Unmuted" : "Track Muted",
      description: track.name,
    });
  }, [tracks, onTracksUpdate, toast]);

  // Handle timeline click
  const handleTimelineClick = useCallback((event: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const clickTime = x / pixelsPerSecond;
    const snappedTime = snapToGrid(clickTime);
    
    onSeek(snappedTime);
  }, [pixelsPerSecond, snapToGrid, onSeek]);

  // Handle timeline resize
  useEffect(() => {
    const updateWidth = () => {
      if (timelineRef.current) {
        setTimelineWidth(timelineRef.current.clientWidth);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Handle track control buttons
  const handleTrackMute = useCallback((track: Track) => {
    const updatedTracks = tracks.map(t => 
      t.id === track.id ? { ...t, isMuted: !t.isMuted } : t
    );
    if (onTracksUpdate) {
      onTracksUpdate(updatedTracks);
    }
  }, [tracks, onTracksUpdate]);

  const handleTrackSolo = useCallback((track: Track) => {
    const updatedTracks = tracks.map(t => 
      t.id === track.id ? { ...t, isSolo: !t.isSolo } : t
    );
    if (onTracksUpdate) {
      onTracksUpdate(updatedTracks);
    }
  }, [tracks, onTracksUpdate]);

  const handleTrackVolumeChange = useCallback((track: Track, volume: number) => {
    const updatedTracks = tracks.map(t => 
      t.id === track.id ? { ...t, volume: volume } : t
    );
    if (onTracksUpdate) {
      onTracksUpdate(updatedTracks);
    }
  }, [tracks, onTracksUpdate]);

  return (
    <div className="flex flex-col h-full bg-background border border-border rounded-lg overflow-hidden">
      {/* Master Controls */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <Button onClick={onPlayPause} size="sm" variant={isPlaying ? "default" : "outline"}>
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button onClick={() => onSeek(0)} size="sm" variant="outline">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <div className="text-sm font-mono">
            {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
          </div>
          <Badge variant="outline">{bpm} BPM</Badge>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            <Slider
              value={[masterVolume]}
              onValueChange={(value) => setMasterVolume(value[0])}
              max={100}
              step={1}
              className="w-20"
            />
            <span className="text-xs w-8">{masterVolume}%</span>
          </div>
        </div>
      </div>

      {/* Timeline Area */}
      <div className="flex-1 flex">
        {/* Track Names Sidebar */}
        <div className="w-48 border-r border-border bg-card">
          <div className="h-12 border-b border-border flex items-center px-3">
            <span className="text-sm font-medium">Tracks</span>
          </div>
          {tracks.map(track => (
            <div key={track.id} className="h-16 border-b border-border p-2 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium truncate flex-1">{track.name}</span>
                <BPMSyncIndicator 
                  sessionBPM={bpm}
                  // You can add detectedBPM if you implement BPM detection
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={track.isMuted ? "default" : "outline"}
                  onClick={() => handleTrackMute(track)}
                  className="h-6 px-2 text-xs"
                >
                  M
                </Button>
                <Button
                  size="sm"
                  variant={track.isSolo ? "default" : "outline"}
                  onClick={() => handleTrackSolo(track)}
                  className="h-6 px-2 text-xs"
                >
                  S
                </Button>
                <Slider
                  value={[track.volume || 1]}
                  onValueChange={(value) => handleTrackVolumeChange(track, value[0])}
                  max={2}
                  min={0}
                  step={0.1}
                  className="flex-1 h-6"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex-1 relative overflow-x-auto">
          <div 
            ref={timelineRef}
            className="relative h-full min-w-full cursor-pointer"
            onClick={handleTimelineClick}
            style={{ width: Math.max(timelineWidth, sessionDuration * pixelsPerSecond) }}
          >
            {/* Ruler */}
            <div className="h-12 border-b border-border bg-card relative">
              {Array.from({ length: totalBars }, (_, i) => (
                <div key={i} className="absolute top-0 h-full flex items-center">
                  <div 
                    className="text-xs text-muted-foreground px-2"
                    style={{ left: i * pixelsPerBar }}
                  >
                    {i + 1}
                  </div>
                  {/* Bar lines */}
                  <div 
                    className="absolute top-0 w-px h-full bg-border"
                    style={{ left: i * pixelsPerBar }}
                  />
                  {/* Beat lines */}
                  {Array.from({ length: beatsPerBar - 1 }, (_, j) => (
                    <div
                      key={j}
                      className="absolute top-6 w-px h-6 bg-border opacity-50"
                      style={{ left: i * pixelsPerBar + (j + 1) * pixelsPerBeat }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Tracks */}
            {tracks.map((track, trackIndex) => (
              <div key={track.id} className="h-16 border-b border-border relative">
                {audioClips
                  .filter(clip => clip.trackId === track.id)
                  .map(clip => (
                    <div
                      key={clip.id}
                      className={`absolute top-1 bottom-1 bg-primary/20 border border-primary rounded cursor-pointer ${
                        selectedClips.has(clip.id) ? 'ring-2 ring-ring' : ''
                      }`}
                      style={{
                        left: clip.startTime * pixelsPerSecond,
                        width: (clip.endTime - clip.startTime) * pixelsPerSecond
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (e.ctrlKey || e.metaKey) {
                          setSelectedClips(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(clip.id)) {
                              newSet.delete(clip.id);
                            } else {
                              newSet.add(clip.id);
                            }
                            return newSet;
                          });
                        } else {
                          setSelectedClips(new Set([clip.id]));
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        // Add context menu logic here
                      }}
                    >
                      <div className="p-1 h-full flex items-center justify-between">
                        <span className="text-xs font-medium truncate text-primary-foreground">
                          {clip.originalTrack.name}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ))}

            {/* Playhead */}
            <div 
              className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
              style={{ left: currentTime * pixelsPerSecond }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};