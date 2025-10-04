import React, { useState, useRef, useEffect, useCallback } from 'react';

// Debug build stamp for TimelineView
const TIMELINE_BUILD = 'TimelineView@2025-10-04T03:28:00Z';
console.warn('[TimelineView] build', TIMELINE_BUILD);
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Circle, Piano } from "lucide-react";
import { BPMSyncIndicator } from './BPMSyncIndicator';
import { useToast } from "@/hooks/use-toast";
import { useWaveformGenerator } from '@/hooks/useWaveformGenerator';
import { generateWaveformBars } from '@/lib/waveformGenerator';
import { AudioBridge } from './AudioBridge';
import { WaveformTrack } from './WaveformTrack';
import { DraggableClip } from './DraggableClip';
import { TrackMidiController } from './TrackMidiController';
import { undoManager, ActionType, createMoveAction } from '@/lib/UndoManager';
import { PianoRoll } from './PianoRoll';
import { TrackMode, PianoRollNote, SampleTrigger } from '@/types/pianoRoll';
import { Music } from 'lucide-react';
import { sessionLoopEngine } from '@/lib/sessionLoopEngine';
import { PianoRollNoteVisualizer } from './PianoRollNoteVisualizer';
import { supabase } from '@/integrations/supabase/client';
import { pianoRollPlaybackEngine } from '@/lib/pianoRollPlaybackEngine';

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
  trimStart?: number;
  trimEnd?: number;
  mode?: TrackMode; // 'midi' or 'sample'
}

interface AudioClip {
  id: string;
  trackId: string;
  startTime: number; // position on timeline (seconds)
  endTime: number;   // derived from trimEnd - trimStart
  fullDuration: number; // total audio length (seconds)
  trimStart: number; // seconds offset into source
  trimEnd: number;   // seconds offset into source
  originalTrack: Track;
  isSelected?: boolean;
}

interface TimelineViewProps {
  tracks: Track[];
  isPlaying: boolean;
  currentTime: number;
  bpm: number;
  metronomeEnabled?: boolean;
  minBars?: number;
  readOnly?: boolean; // If true, viewer mode (no loop engine)
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onTracksUpdate?: (tracks: Track[]) => void;
  onTrimTrack?: (trackId: string, trimStart: number, trimEnd: number) => void;
  onHardStop?: () => void;
  setActiveTrack?: (trackId: string) => void;
  activeTrackId?: string;
  createTrack?: (name: string) => string;
  loadSample?: (trackId: string, file: File) => Promise<void>;
  onPianoRollStateChange?: (state: { isOpen: boolean; trackId?: string; trackName?: string; mode?: 'midi' | 'sample'; sampleUrl?: string }) => void;
  sessionId?: string;
};

export const TimelineView: React.FC<TimelineViewProps> = ({
  tracks,
  isPlaying,
  currentTime,
  bpm,
  metronomeEnabled = false,
  minBars = 8,
  readOnly = false,
  onPlayPause,
  onSeek,
  onTracksUpdate,
  onTrimTrack,
  onHardStop,
  setActiveTrack,
  activeTrackId,
  createTrack,
  loadSample,
  onPianoRollStateChange,
  sessionId,
 }) => {
  const [activeMidiTrackId, setActiveMidiTrackId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [trackDurations, setTrackDurations] = useState<Map<string, number>>(new Map());
  const [masterVolume, setMasterVolume] = useState(100);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [copiedClip, setCopiedClip] = useState<AudioClip | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [armedTracks, setArmedTracks] = useState<Set<string>>(new Set());
  const [pianoRollOpen, setPianoRollOpen] = useState(false);
  const [pianoRollTrack, setPianoRollTrack] = useState<{ id: string; name: string; mode: TrackMode; sampleUrl?: string } | null>(null);
  const [trackNotes, setTrackNotes] = useState<Map<string, { notes: PianoRollNote[]; triggers: SampleTrigger[] }>>(new Map());
  const { toast } = useToast();

  // Broadcast piano roll state changes
  React.useEffect(() => {
    onPianoRollStateChange?.({
      isOpen: pianoRollOpen,
      trackId: pianoRollTrack?.id,
      trackName: pianoRollTrack?.name,
      mode: pianoRollTrack?.mode,
      sampleUrl: pianoRollTrack?.sampleUrl,
    });
  }, [pianoRollOpen, pianoRollTrack, onPianoRollStateChange]);

  // Load piano roll notes for all tracks
  React.useEffect(() => {
    const loadTrackNotes = async () => {
      for (const track of tracks) {
        const { data, error } = await supabase
          .from('track_midi_notes')
          .select('*')
          .eq('track_id', track.id);

        if (error) {
          console.error('Error loading piano roll notes:', error);
          continue;
        }

        if (data && data.length > 0) {
          const notes: PianoRollNote[] = [];
          const triggers: SampleTrigger[] = [];

          data.forEach(dbNote => {
            if (dbNote.note_type === 'note') {
              notes.push({
                id: dbNote.id,
                pitch: dbNote.pitch,
                startTime: dbNote.start_time,
                duration: dbNote.duration,
                velocity: dbNote.velocity,
              });
            } else {
              triggers.push({
                id: dbNote.id,
                pitch: dbNote.pitch,
                startTime: dbNote.start_time,
                velocity: dbNote.velocity,
                duration: dbNote.duration,
              });
            }
          });

          setTrackNotes(prev => new Map(prev.set(track.id, { notes, triggers })));
        }
      }
    };

    if (tracks.length > 0) {
      loadTrackNotes();
    }
  }, [tracks]);

  // Initialize piano roll playback engine and register tracks with notes
  // ONLY if track is NOT already on the timeline as a clip
  React.useEffect(() => {
    const initializePlayback = async () => {
      await pianoRollPlaybackEngine.initialize();
      
      // Get track IDs that are already on the timeline as clips
      const tracksOnTimeline = new Set(audioClips.map(clip => clip.trackId));
      
      // Register all tracks with piano roll notes EXCEPT those already on timeline
      trackNotes.forEach((noteData, trackId) => {
        const track = tracks.find(t => t.id === trackId);
        if (!track) return;
        
        // Skip if track is already on timeline - it will play via session loop engine
        if (tracksOnTimeline.has(trackId)) {
          console.log(`🎹 Skipping piano roll playback for ${track.name} - already on timeline`);
          return;
        }
        
        const mode = track.mode || 'sample';
        
        if (mode === 'midi' && noteData.notes.length > 0) {
          console.log(`🎹 Registering MIDI track ${track.name} for piano roll playback`);
          pianoRollPlaybackEngine.registerMidiTrack(trackId, noteData.notes);
        } else if (mode === 'sample' && noteData.triggers.length > 0) {
          console.log(`🎹 Registering sample track ${track.name} for piano roll playback`);
          // For sample mode, we need the samplers map - this will be empty initially
          // Samplers are loaded in PianoRoll component, so we'll handle this there
          // For now, just register with empty map - will be updated when piano roll opens
          pianoRollPlaybackEngine.registerSampleTrack(trackId, noteData.triggers, new Map());
        }
      });
    };
    
    if (trackNotes.size > 0) {
      initializePlayback();
    }
  }, [trackNotes, tracks, audioClips]);

  // Listen for realtime piano roll note changes
  React.useEffect(() => {
    const channel = supabase
      .channel('timeline-piano-roll-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'track_midi_notes',
        },
        (payload) => {
          console.log('Piano roll note change:', payload);
          const note = payload.new as any;
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setTrackNotes(prev => {
              const existing = prev.get(note.track_id) || { notes: [], triggers: [] };
              
              if (note.note_type === 'note') {
                const noteData: PianoRollNote = {
                  id: note.id,
                  pitch: note.pitch,
                  startTime: note.start_time,
                  duration: note.duration,
                  velocity: note.velocity,
                };
                const filtered = existing.notes.filter(n => n.id !== note.id);
                return new Map(prev.set(note.track_id, { ...existing, notes: [...filtered, noteData] }));
              } else {
                const triggerData: SampleTrigger = {
                  id: note.id,
                  pitch: note.pitch,
                  startTime: note.start_time,
                  velocity: note.velocity,
                  duration: note.duration,
                };
                const filtered = existing.triggers.filter(t => t.id !== note.id);
                return new Map(prev.set(note.track_id, { ...existing, triggers: [...filtered, triggerData] }));
              }
            });
          } else if (payload.eventType === 'DELETE') {
            const oldNote = payload.old as any;
            setTrackNotes(prev => {
              const existing = prev.get(oldNote.track_id);
              if (!existing) return prev;
              
              const updated = {
                notes: existing.notes.filter(n => n.id !== oldNote.id),
                triggers: existing.triggers.filter(t => t.id !== oldNote.id),
              };
              return new Map(prev.set(oldNote.track_id, updated));
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);


  // Calculate timing constants with precise BPM
  const secondsPerBeat = 60 / bpm; // Precise: 60 seconds / beats per minute
  const beatsPerBar = 4;
  const secondsPerBar = secondsPerBeat * beatsPerBar;

  // Calculate session length based on clips with a minimum bar count
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
    0
  );
  
  // Enforce minimum visible bars in the UI
  const sessionDuration = Math.max(lastClipEndTime, (minBars || 8) * secondsPerBar);
  const totalBars = Math.ceil(sessionDuration / secondsPerBar);
  
  const pixelsPerSecond = 40;
  const pixelsPerBeat = pixelsPerSecond * secondsPerBeat;
  const pixelsPerBar = pixelsPerBeat * beatsPerBar;

  // Handle tick updates from AudioBridge and schedule piano roll notes on playback
  const handleTick = useCallback((seconds: number) => {
    if (Math.abs(seconds - currentTime) > 0.05) {
      onSeek(seconds);
    }
  }, [currentTime, onSeek]);

  // Schedule piano roll notes when playback starts
  React.useEffect(() => {
    if (isPlaying && !readOnly) {
      console.log('🎹 Scheduling piano roll playback');
      pianoRollPlaybackEngine.schedulePlayback(bpm);
    } else {
      pianoRollPlaybackEngine.clearSchedules();
    }
  }, [isPlaying, bpm, readOnly]);

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

  // Proactively measure duration for tracks without known duration (quick, local decode)
  const measuredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const measure = async () => {
      for (const t of tracks) {
        if (!t.file_url || measuredRef.current.has(t.id)) continue;
        const known = trackDurations.get(t.id) || t.analyzed_duration || t.duration;
        if (known && known > 0) continue;
        try {
          console.log('[Timeline] Quick measuring duration for', t.name);
          const res = await fetch(t.file_url, { mode: 'cors' });
          const buf = await res.arrayBuffer();
          const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioCtx();
          const audioBuf = await ctx.decodeAudioData(buf);
          const dur = audioBuf.duration;
          ctx.close?.();
          measuredRef.current.add(t.id);
          setTrackDurations(prev => new Map(prev.set(t.id, dur)));
        } catch (e) {
          console.warn('[Timeline] Duration probe failed for', t.name, e);
          measuredRef.current.add(t.id);
        }
      }
    };
    measure();
  }, [tracks, trackDurations]);

  // When analyzed/known durations arrive, extend initial placeholder clips to full length
  useEffect(() => {
    if (audioClips.length === 0) return;

    setAudioClips(prev => {
      let changed = false;
      const updated = prev.map(clip => {
        // Prefer duration from trackDurations map; fallback to track fields
        const known = trackDurations.get(clip.trackId) || clip.originalTrack.analyzed_duration || clip.originalTrack.duration || 0;
        if (!known || known <= 0) return clip;

        const desiredEnd = clip.startTime + known; // seconds
        // Only auto-extend if this was the initial clip starting at 0 and shorter than the analyzed length
        // AND hasn't been manually trimmed (trimStart is 0 and trimEnd matches current endTime)
        const isUntrimmed = (clip.trimStart === 0 || clip.trimStart === undefined) && 
                           (clip.trimEnd === clip.endTime || clip.trimEnd === undefined || Math.abs(clip.trimEnd - clip.endTime) < 0.01);
        if (clip.startTime === 0 && desiredEnd > clip.endTime + 0.01 && isUntrimmed) {
          changed = true;
          return { ...clip, endTime: desiredEnd, trimEnd: known };
        }
        return clip;
      });
      return changed ? updated : prev;
    });
  }, [trackDurations, audioClips.length]);

  // Update clip durations when tracks are trimmed
  useEffect(() => {
    setAudioClips(prev => {
      let changed = false;
      const updated = prev.map(clip => {
        const track = tracks.find(t => t.id === clip.trackId);
        if (!track) return clip;
        
        const trackDuration = track.analyzed_duration || track.duration || 0;
        const trimStart = Math.max(0, track.trimStart || 0);
        const effectiveTrimEnd = Math.max(trimStart + 0.1, Math.min(trackDuration || Infinity, track.trimEnd ?? trackDuration));
        const trimmedDuration = Math.max(0.1, (effectiveTrimEnd - trimStart));
        const newEndTime = clip.startTime + trimmedDuration;
        
        // Determine if anything changed (duration or originalTrack reference)
        const durationChanged = Math.abs(newEndTime - clip.endTime) > 0.01;
        const trackRefChanged = clip.originalTrack !== track;
        
        if (durationChanged || trackRefChanged) {
          changed = true;
          return { ...clip, endTime: newEndTime, originalTrack: track };
        }
        return clip;
      });
      return changed ? updated : prev;
    });
  }, [tracks]);

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
              // Calculate bars based on the actual audio duration for full track length
              resolvedBars = Math.max(1, Math.ceil(knownDuration / secondsPerBar));
            } else {
              // If no duration is known yet, default to 4 bars and wait for analysis
              resolvedBars = 4; 
            }
          }
          // Use the actual known duration if available, otherwise use bars calculation
          const clipDuration = knownDuration && knownDuration > 0 ? knownDuration : (resolvedBars * secondsPerBar);
          
          const clip: AudioClip = {
            id: `${track.id}-clip-0`,
            trackId: track.id,
            startTime: 0,
            endTime: clipDuration, // start + (trimEnd - trimStart)
            fullDuration: clipDuration,
            trimStart: 0,
            trimEnd: clipDuration,
            originalTrack: track
          };
          console.log('Creating clip for NEW track:', track.name, 'Bars:', resolvedBars, 'Duration:', clipDuration, 'Known duration:', knownDuration, 'Clip:', clip);
          return clip;
        });
        
        // Add new clips to existing ones instead of replacing
        console.log('Adding new clips to existing arrangement - existing:', audioClips, 'new:', newClips);
        setAudioClips(prev => [...prev, ...newClips]);
        
        // Register add clip actions with UndoManager
        newClips.forEach(clip => {
          const addClipAction = {
            type: ActionType.ADD_CLIP,
            payload: { trackId: clip.trackId, clip },
            undo: () => {
              console.log(`🔄 Undoing add clip: ${clip.originalTrack.name}`);
              setAudioClips(prev => prev.filter(c => c.id !== clip.id));
            },
            description: `Add clip "${clip.originalTrack.name}" to timeline`
          };
          undoManager.push(addClipAction);
        });
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
      fullDuration: copiedClip.fullDuration,
      trimStart: copiedClip.trimStart,
      trimEnd: copiedClip.trimEnd,
      originalTrack: copiedClip.originalTrack
    };

    console.log('Pasting clip:', newClip);
    setAudioClips(prev => [...prev, newClip]);
    
    // Register paste action with UndoManager
    const pasteClipAction = {
      type: ActionType.ADD_CLIP,
      payload: { trackId: newClip.trackId, clip: newClip },
      undo: () => {
        console.log(`🔄 Undoing paste clip: ${newClip.originalTrack.name}`);
        setAudioClips(prev => prev.filter(c => c.id !== newClip.id));
      },
      description: `Paste clip "${newClip.originalTrack.name}" at ${snappedTime.toFixed(2)}s`
    };
    undoManager.push(pasteClipAction);
    
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
      fullDuration: clip.fullDuration,
      trimStart: clip.trimStart,
      trimEnd: clip.trimEnd,
      originalTrack: clip.originalTrack
    };

    console.log('Duplicating clip:', clip, 'New clip:', newClip);
    setAudioClips(prev => [...prev, newClip]);
    
    // Register duplicate action with UndoManager
    const duplicateClipAction = {
      type: ActionType.DUPLICATE_CLIP,
      payload: { trackId: newClip.trackId, clip: newClip },
      undo: () => {
        console.log(`🔄 Undoing duplicate clip: ${newClip.originalTrack.name}`);
        setAudioClips(prev => prev.filter(c => c.id !== newClip.id));
      },
      description: `Duplicate clip "${newClip.originalTrack.name}"`
    };
    undoManager.push(duplicateClipAction);
    
    toast({
      title: "Clip Duplicated",
      description: `${clip.originalTrack.name} duplicated`,
    });
  }, [audioClips, snapToGrid, toast]);

  // Move clip function
  const moveClip = useCallback((clipId: string, newStartTime: number) => {
    const targetClip = audioClips.find(clip => clip.id === clipId);
    if (!targetClip) return;

    const originalStartTime = targetClip.startTime;
    const duration = targetClip.endTime - targetClip.startTime;
    const newEndTime = newStartTime + duration;

    if (Math.abs(newStartTime - originalStartTime) < 0.01) return;

    console.log(`🎵 Moving clip ${clipId} from ${originalStartTime}s to ${newStartTime}s`);

    setAudioClips(prev => prev.map(c => c.id === clipId ? { ...c, startTime: newStartTime, endTime: newEndTime } : c));

    const fromPos = { startTime: originalStartTime, endTime: originalStartTime + duration };
    const toPos = { startTime: newStartTime, endTime: newEndTime };
    const moveAction = createMoveAction(
      targetClip.trackId,
      clipId,
      fromPos,
      toPos,
      () => {
        setAudioClips(prev => prev.map(c => c.id === clipId ? { ...c, startTime: originalStartTime, endTime: originalStartTime + duration } : c));
      },
      `Move clip from ${originalStartTime.toFixed(2)}s to ${newStartTime.toFixed(2)}s`
    );
    undoManager.push(moveAction);
  }, [audioClips]);

  // Delete track function
  const deleteTrack = useCallback((trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    // Get all clips that will be removed
    const clipsToRemove = audioClips.filter(clip => clip.trackId === trackId);
    
    console.log('Deleting track:', track.name, 'ID:', trackId, 'Clips to remove:', clipsToRemove);
    
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

    // Register delete track action with UndoManager (restores clips but not the track itself)
    if (clipsToRemove.length > 0) {
      const deleteTrackAction = {
        type: ActionType.REMOVE_TRACK,
        payload: { track, clips: clipsToRemove },
        undo: () => {
          console.log(`🔄 Undoing delete track: ${track.name} - restoring ${clipsToRemove.length} clips`);
          setAudioClips(prev => [...prev, ...clipsToRemove]);
        },
        description: `Delete track "${track.name}" and ${clipsToRemove.length} clips`
      };
      undoManager.push(deleteTrackAction);
    }
    
    toast({
      title: "Track Deleted",
      description: `${track.name} removed from session`,
    });
  }, [tracks, audioClips, onTracksUpdate, toast]);

  // Delete clip function
  const deleteClip = useCallback((clipId: string) => {
    const clipToDelete = audioClips.find(c => c.id === clipId);
    if (!clipToDelete) {
      console.warn('Clip not found for deletion:', clipId);
      return;
    }

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

    // Register delete action with UndoManager
    const deleteClipAction = {
      type: ActionType.REMOVE_CLIP,
      payload: { trackId: clipToDelete.trackId, clip: clipToDelete },
      undo: () => {
        console.log(`🔄 Undoing delete clip: ${clipToDelete.originalTrack.name}`);
        setAudioClips(prev => [...prev, clipToDelete]);
      },
      description: `Delete clip "${clipToDelete.originalTrack.name}"`
    };
    undoManager.push(deleteClipAction);

    toast({
      title: "Clip Deleted",
      description: "Audio clip removed",
    });
  }, [audioClips, toast]);

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
    console.log('[TimelineView] Toggling mute for track:', track.name, 'Current muted:', track.isMuted, 'New muted:', newMutedState);

    // Immediate audio feedback for hosts: mute/unmute associated clips in the engine
    try {
      if (!readOnly) {
        const affectedClips = audioClips.filter(c => c.trackId === track.id);
        affectedClips.forEach(c => sessionLoopEngine.muteClip(c.id, newMutedState));
        console.log('[TimelineView] Applied mute to engine clips:', affectedClips.map(c => c.id));
      }
    } catch (err) {
      console.warn('[TimelineView] Engine mute failed (viewer mode or engine not ready):', err);
    }
    
    // Update track in parent component so UI and state persist
    if (onTracksUpdate) {
      const updatedTracks = tracks.map(t => 
        t.id === track.id ? { ...t, isMuted: newMutedState } : t
      );
      console.log('[TimelineView] Calling onTracksUpdate with updated tracks:', updatedTracks.map(t => ({ id: t.id, name: t.name, isMuted: t.isMuted })));
      onTracksUpdate(updatedTracks);
    } else {
      console.warn('[TimelineView] onTracksUpdate callback is not defined');
    }

    // User feedback
    toast({
      title: newMutedState ? 'Track Muted' : 'Track Unmuted',
      description: track.name,
    });
  }, [audioClips, onTracksUpdate, readOnly, toast, tracks]);

  // Update timeline width
  useEffect(() => {
    if (timelineRef.current) {
      setTimelineWidth(timelineRef.current.offsetWidth);
    }
  }, []);

  const handleTimelineClick = useCallback((event: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    // Don't handle timeline clicks if clicking on the playhead
    if ((event.target as HTMLElement).closest('.playhead-container')) return;
    
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
          <div className="w-px h-full bg-white/20 relative" style={{ left: Math.max(1, x) }}>
            <span className="absolute top-1 left-1 text-xs text-white z-30 bg-gray-900/80 px-1 rounded">
              {bar + 1}
            </span>
          </div>
          {/* Beat markers - show all 4 beats per bar */}
          {[1, 2, 3, 4].map(beat => (
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
        {/* Beat grid lines for this track */}
        {Array.from({ length: totalBars }).map((_, bar) => 
          [1, 2, 3, 4].map(beat => (
            <div
              key={`track-${track.id}-beat-${bar}-${beat}`}
              className="absolute w-px bg-white/5 pointer-events-none z-0"
              style={{ 
                left: bar * pixelsPerBar + beat * pixelsPerBeat,
                top: 0,
                height: '100%'
              }}
            />
          ))
        ).flat()}
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

          // Always render; rely on CSS clipping instead of conditional unmounts
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
                // Handle track selection
                setSelectedTrack(track.id);
                
                // Handle clip selection
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
              onDeleteClip={deleteClip}
              onTrimClip={(clipId, edge, s, e) => {
                setAudioClips(prev => prev.map(c => {
                  if (c.id !== clipId) return c;
                  const fullDur = c.fullDuration;
                  const minGap = 0.01;
                  const curS = c.trimStart;
                  const curE = c.trimEnd;
                  if (edge === 'start') {
                    const newS = Math.min(Math.max(0, s), Math.min(fullDur - minGap, curE - minGap));
                    const newVisible = curE - newS; // keep end fixed
                    const newStart = c.endTime - newVisible; // lock right edge
                    const next = { ...c, trimStart: newS, startTime: newStart };
                    console.log('[Trim] start', { s, e, newS, curE, newStart, next });
                    return next;
                  } else {
                    const newE = Math.max(Math.min(e, fullDur), Math.max(curS + minGap, 0));
                    const newVisible = newE - curS; // keep start fixed
                    const newEnd = c.startTime + newVisible;
                    const next = { ...c, trimEnd: newE, endTime: newEnd };
                    console.log('[Trim] end', { s, e, curS, newE, newEnd, next });
                    return next;
                  }
                }));
              }}
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
        minBars={minBars}
        isHost={!readOnly} // Viewers don't run the loop engine
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
        <div className="flex flex-1 overflow-hidden max-h-[calc(100vh-200px)]">
          {/* Track Names Sidebar - Fixed width, scrolls with timeline */}
          <div className="w-48 bg-black/60 border-r border-white/10 flex flex-col flex-shrink-0">
            {/* Master Volume - Fixed */}
            <div className="h-[127px] flex-shrink-0 flex flex-col justify-center p-3 border-b border-white/10">
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

            {/* Track Controls - Scrollable */}
            <div className="flex-1 overflow-y-auto scrollbar-hide track-controls-sidebar">
              {tracks.map((track, index) => {
                console.log('Sidebar track', index, ':', track.name, '(ID:', track.id, ')');
                const isTrackSelected = selectedTrack === track.id;
                return (
                  <div 
                    key={track.id} 
                    className={`h-[115px] p-3 border-b border-white/10 cursor-pointer transition-all duration-200 ${
                      isTrackSelected 
                        ? 'bg-neon-cyan/20 border-neon-cyan/30 shadow-[0_0_15px_rgba(0,255,255,0.3)]' 
                        : 'bg-black/20 hover:bg-black/30'
                    }`}
                    onClick={() => setSelectedTrack(track.id)}
                  >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-white truncate" title={track.name}>
                      {track.name}
                    </span>
                    <div className="flex items-center gap-1">
                      {/* Record Arm Button */}
                      <button
                        type="button"
                        className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-all duration-200 ${
                          armedTracks.has(track.id)
                            ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] text-white' 
                            : 'bg-background/80 border border-border text-foreground hover:bg-red-500/20 hover:border-red-500'
                        }`}
                        aria-label={armedTracks.has(track.id) ? "Disarm recording" : "Arm for recording"}
                        title={`${armedTracks.has(track.id) ? "Disarm" : "Arm"} recording (Shift+click for multi-arm)`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setArmedTracks(prev => {
                            const newArmed = new Set(prev);
                            if (e.shiftKey) {
                              // Multi-arm mode: toggle this track without affecting others
                              if (newArmed.has(track.id)) {
                                newArmed.delete(track.id);
                              } else {
                                newArmed.add(track.id);
                              }
                            } else {
                              // Single-arm mode: clear all and arm this track if not already armed
                              if (newArmed.has(track.id) && newArmed.size === 1) {
                                newArmed.clear(); // Disarm if only this track is armed
                              } else {
                                newArmed.clear();
                                newArmed.add(track.id);
                              }
                            }
                            return newArmed;
                          });
                        }}
                      >
                        <Circle className={`w-3 h-3 ${armedTracks.has(track.id) ? 'fill-current' : ''}`} />
                      </button>
                      
                      {/* Edit Notes Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPianoRollTrack({
                            id: track.id,
                            name: track.name,
                            mode: track.mode || 'sample',
                            sampleUrl: track.file_url
                          });
                          setPianoRollOpen(true);
                        }}
                        title="Edit Notes (Piano Roll)"
                      >
                        <Piano className="h-3 w-3" />
                      </Button>
                      
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
                  <Button
                    variant={activeMidiTrackId === track.id ? "default" : "outline"}
                    size="sm"
                    className={`text-xs mt-1 px-2 py-1 h-6 transition-all duration-300 ${
                      activeMidiTrackId === track.id 
                        ? 'bg-green-500 hover:bg-green-600 text-black border-green-400 shadow-[var(--glow-green)] animate-pulse' 
                        : 'hover:border-green-400/50 hover:text-green-400'
                    }`}
                    onClick={async () => {
                      try {
                        // Create engine track and load the sample
                        if (createTrack && loadSample && track.file_url) {
                          const engineTrackId = createTrack(track.name);
                          
                          // Convert URL to File for loading
                          const response = await fetch(track.file_url);
                          const blob = await response.blob();
                          const file = new File([blob], track.name, { type: 'audio/wav' });
                          
                          await loadSample(engineTrackId, file);
                          setActiveTrack?.(engineTrackId);
                          setActiveMidiTrackId(track.id); // Track which timeline track is MIDI active
                        }
                      } catch (error) {
                        console.error('❌ Failed to activate MIDI for track:', error);
                        setActiveMidiTrackId(null);
                      }
                    }}
                  >
                    <Piano className="w-3 h-3 mr-1" />
                    MIDI
                  </Button>
                </div>
              );
            })}
            </div>
          </div>

          {/* Timeline Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Ruler - Fixed at top */}
            <div className="h-[63.5px] bg-black/40 border-b border-white/10 relative flex-shrink-0">
              {Array.from({ length: totalBars }).map((_, bar) => 
                [1, 2, 3, 4].map(beat => (
                  <div
                    key={`track-beat-${bar}-${beat}`}
                    className="absolute w-px bg-white/5 pointer-events-none z-10"
                    style={{ 
                      left: bar * pixelsPerBar + beat * pixelsPerBeat,
                      top: 0,
                      height: '100%'
                    }}
                  />
                ))
              ).flat()}
              
              {renderBarMarkers()}
              <div className="absolute top-6 left-2 text-xs text-gray-400">
                Position: {formatPosition(currentTime)} | Bar: {formatTime(currentTime)}
              </div>
            </div>

            {/* Master Output Visualization - Fixed */}
            <div className="h-[63.5px] bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-white/10 relative flex-shrink-0">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-gray-400">Master Output</span>
              </div>
            </div>

            {/* Timeline Tracks - Scrollable */}
            <div 
              className="flex-1 relative overflow-x-auto overflow-y-auto scrollbar-hide" 
              ref={timelineRef} 
              data-build={TIMELINE_BUILD}
              onScroll={(e) => {
                const sidebar = document.querySelector('.track-controls-sidebar');
                if (sidebar) {
                  sidebar.scrollTop = e.currentTarget.scrollTop;
                }
              }}
            >
              {/* Beat grid lines */}
              <div className="absolute top-0 left-0 right-0" style={{ height: `${tracks.length * 115}px` }}>
                {Array.from({ length: totalBars }).map((_, bar) => 
                  [1, 2, 3, 4].map(beat => (
                    <div
                      key={`timeline-beat-${bar}-${beat}`}
                      className="absolute w-px bg-white/5 pointer-events-none z-10"
                      style={{ 
                        left: bar * pixelsPerBar + beat * pixelsPerBeat,
                        top: 0,
                        height: '100%'
                      }}
                    />
                  ))
                ).flat()}
              </div>

              {/* Playhead */}
              <div
                className="playhead-container absolute top-0 bottom-0 w-0.5 bg-primary z-20 cursor-pointer hover:w-1 transition-all"
                style={{ left: (currentTime % sessionDuration) * pixelsPerSecond }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const startX = e.clientX;
                  const startTime = currentTime;
                  
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    if (!timelineRef.current) return;
                    
                    const rect = timelineRef.current.getBoundingClientRect();
                    const deltaX = moveEvent.clientX - startX;
                    const deltaTime = deltaX / pixelsPerSecond;
                    const newTime = Math.max(0, Math.min(sessionDuration, startTime + deltaTime));
                    
                    onSeek(newTime);
                  };
                  
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                  };
                  
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                  document.body.style.cursor = 'grabbing';
                  document.body.style.userSelect = 'none';
                }}
              >
                <div 
                  className="absolute -top-2 -left-1 w-3 h-3 bg-primary rotate-45 hover:scale-125 transition-transform cursor-grab active:cursor-grabbing" 
                />
              </div>

              {tracks.map((track, index) => {
                const trackY = index * 127;
                const trackHeight = 115;
                const trackNotesData = trackNotes.get(track.id);
                
                console.log('Rendering track', index, ':', track.name, '(ID:', track.id, ')');
                
                return (
                  <div
                    key={track.id}
                    className={`relative border-b border-white/10 transition-all duration-200 ${
                      selectedTrack === track.id 
                        ? 'border-neon-cyan shadow-[0_0_15px_rgba(0,255,255,0.3)]'
                        : ''
                    }`}
                    style={{ height: trackHeight }}
                    onClick={() => setSelectedTrack(track.id)}
                  >
                    <EnhancedWaveformTrack
                      track={track}
                      clips={audioClips}
                      trackY={trackY}
                      trackHeight={trackHeight}
                      trackIndex={index}
                    />
                    {trackNotesData && (
                      <PianoRollNoteVisualizer
                        trackId={track.id}
                        notes={trackNotesData.notes || []}
                        triggers={trackNotesData.triggers || []}
                        mode={track.mode || 'sample'}
                        bpm={bpm}
                        pixelsPerSecond={pixelsPerSecond}
                        currentTime={currentTime}
                        isPlaying={isPlaying}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* MIDI Controller for triggering selected track audio */}
      <TrackMidiController
        selectedClip={
          selectedClips.size > 0
            ? audioClips.find(clip => selectedClips.has(clip.id))
            : (selectedTrack
                ? (audioClips.find(clip => clip.trackId === selectedTrack && clip.startTime <= currentTime && clip.endTime >= currentTime)
                    || audioClips.find(clip => clip.trackId === selectedTrack) )
                : undefined)
        }
        isEnabled={!!activeMidiTrackId}
        onNoteTriggered={(noteNumber, velocity) => {
          console.log(`🎹 MIDI triggered note ${noteNumber} with velocity ${velocity}`);
        }}
        onRecordingStateChange={(isRecording) => {
          console.log(`🔴 MIDI recording: ${isRecording ? 'started' : 'stopped'}`);
        }}
      />

      {/* Piano Roll Editor */}
      {pianoRollTrack && (
        <PianoRoll
          isOpen={pianoRollOpen}
          onClose={() => {
            setPianoRollOpen(false);
            setPianoRollTrack(null);
          }}
          trackId={pianoRollTrack.id}
          trackName={pianoRollTrack.name}
          trackMode={pianoRollTrack.mode}
          trackSampleUrl={pianoRollTrack.sampleUrl}
          sessionBpm={bpm}
          sessionIsPlaying={isPlaying}
          sessionCurrentTime={currentTime}
          onToggleSessionPlayback={onPlayPause}
          onStopSession={() => onSeek(0)}
          onHardStop={onHardStop}
          onSave={(trackId, data) => {
            console.log('Saving piano roll data for track:', trackId, data);
            toast({
              title: "Piano Roll Saved",
              description: `Changes saved for ${pianoRollTrack.name}`,
            });
          }}
        />
      )}
    </>
  );
};
