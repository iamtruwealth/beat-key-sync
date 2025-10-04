import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  PianoRollNote, 
  SampleTrigger, 
  PianoRollTrack, 
  PianoRollState, 
  SnapGridValue, 
  TrackMode,
  SampleMapping 
} from '@/types/pianoRoll';

export const usePianoRoll = (initialBpm: number = 120) => {
  const [state, setState] = useState<PianoRollState>({
    tracks: {},
    activeTrackId: null,
    isPlaying: false,
    currentTime: 0,
    bpm: initialBpm,
    snapGrid: '1/4-beat',
    zoom: 1,
    selectedNotes: [],
  });

  const playbackIntervalRef = useRef<number | null>(null);

  // Calculate snap amount in beats based on snap grid value
  const getSnapAmount = useCallback((snapGrid: SnapGridValue, beatsPerBar: number = 4): number => {
    switch (snapGrid) {
      case 'none': return 0;
      case 'line': return 0.01; // Very fine snap
      case 'cell': return 0.25; // Quarter beat
      case '1/6-step': return 1/24; // 1/6 of 1/4 beat
      case '1/4-step': return 1/16;
      case '1/3-step': return 1/12;
      case '1/2-step': return 1/8;
      case '1-step': return 0.25;
      case '1/6-beat': return 1/6;
      case '1/4-beat': return 0.25;
      case '1/3-beat': return 1/3;
      case '1/2-beat': return 0.5;
      case '1-beat': return 1;
      case '1-bar': return beatsPerBar;
      default: return 0.25;
    }
  }, []);

  // Snap time to grid
  const snapToGrid = useCallback((time: number): number => {
    const snapAmount = getSnapAmount(state.snapGrid);
    if (snapAmount === 0) return time;
    return Math.round(time / snapAmount) * snapAmount;
  }, [state.snapGrid, getSnapAmount]);

  // Create new track (optionally specify id)
  const createTrack = useCallback((name: string, mode: TrackMode, idOverride?: string): string => {
    const id = idOverride ?? `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newTrack: PianoRollTrack = {
      id,
      name,
      mode,
      notes: [],
      triggers: [],
      sampleMappings: [],
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
    };

    setState(prev => ({
      ...prev,
      tracks: { ...prev.tracks, [id]: newTrack },
      activeTrackId: id,
    }));

    return id;
  }, []);

  // Set active track
  const setActiveTrack = useCallback((trackId: string | null) => {
    setState(prev => ({ ...prev, activeTrackId: trackId }));
  }, []);

  // Add note to track
  const addNote = useCallback((trackId: string, note: Omit<PianoRollNote, 'id'>): string => {
    const noteId = `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const snappedNote: PianoRollNote = {
      ...note,
      id: noteId,
      startTime: snapToGrid(note.startTime),
      duration: Math.max(0.25, note.duration), // Minimum duration
    };

    setState(prev => {
      const track = prev.tracks[trackId];
      if (!track) return prev;

      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...track,
            notes: [...track.notes, snappedNote],
          },
        },
      };
    });

    return noteId;
  }, [snapToGrid]);

  // Add sample trigger to track
  const addTrigger = useCallback((trackId: string, trigger: Omit<SampleTrigger, 'id'>): string => {
    const triggerId = `trigger-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const snappedTrigger: SampleTrigger = {
      ...trigger,
      id: triggerId,
      startTime: snapToGrid(trigger.startTime),
      duration: trigger.duration || 1, // Default 1 beat duration
    };

    setState(prev => {
      const track = prev.tracks[trackId];
      if (!track) return prev;

      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...track,
            triggers: [...track.triggers, snappedTrigger],
          },
        },
      };
    });

    return triggerId;
  }, [snapToGrid]);

  // Delete note
  const deleteNote = useCallback((trackId: string, noteId: string) => {
    setState(prev => {
      const track = prev.tracks[trackId];
      if (!track) return prev;

      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...track,
            notes: track.notes.filter(n => n.id !== noteId),
          },
        },
      };
    });
  }, []);

  // Delete trigger
  const deleteTrigger = useCallback((trackId: string, triggerId: string) => {
    setState(prev => {
      const track = prev.tracks[trackId];
      if (!track) return prev;

      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...track,
            triggers: track.triggers.filter(t => t.id !== triggerId),
          },
        },
      };
    });
  }, []);

  // Update note
  const updateNote = useCallback((trackId: string, noteId: string, updates: Partial<PianoRollNote>) => {
    setState(prev => {
      const track = prev.tracks[trackId];
      if (!track) return prev;

      // Update in notes array
      const updatedNotes = track.notes.map(n => 
        n.id === noteId 
          ? { 
              ...n, 
              ...updates,
              startTime: updates.startTime !== undefined ? snapToGrid(updates.startTime) : n.startTime,
            }
          : n
      );

      // Also check triggers array for sample mode
      const updatedTriggers = track.triggers.map(t => 
        t.id === noteId 
          ? { 
              ...t, 
              ...updates,
              startTime: updates.startTime !== undefined ? snapToGrid(updates.startTime) : t.startTime,
            }
          : t
      );

      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...track,
            notes: updatedNotes,
            triggers: updatedTriggers,
          },
        },
      };
    });
  }, [snapToGrid]);

  // Add sample mapping
  const addSampleMapping = useCallback((trackId: string, mapping: SampleMapping) => {
    setState(prev => {
      const track = prev.tracks[trackId];
      if (!track) return prev;

      // Remove existing mapping for this pitch
      const filteredMappings = track.sampleMappings.filter(m => m.pitch !== mapping.pitch);

      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...track,
            sampleMappings: [...filteredMappings, mapping],
          },
        },
      };
    });
  }, []);

  // Set snap grid
  const setSnapGrid = useCallback((snapGrid: SnapGridValue) => {
    setState(prev => ({ ...prev, snapGrid }));
  }, []);

  // Set zoom
  const setZoom = useCallback((zoom: number) => {
    setState(prev => ({ ...prev, zoom: Math.max(0.5, Math.min(4, zoom)) }));
  }, []);

  // Toggle playback
  const togglePlayback = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  // Stop playback
  const stopPlayback = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
  }, []);

  // Set current time
  const setCurrentTime = useCallback((time: number) => {
    setState(prev => ({ ...prev, currentTime: Math.max(0, time) }));
  }, []);

  // Select notes
  const selectNotes = useCallback((noteIds: string[]) => {
    setState(prev => ({ ...prev, selectedNotes: noteIds }));
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedNotes: [] }));
  }, []);

  // Playback loop
  useEffect(() => {
    if (state.isPlaying) {
      const beatsPerSecond = state.bpm / 60;
      const updateInterval = 50; // Update every 50ms
      const beatsPerUpdate = (beatsPerSecond * updateInterval) / 1000;

      playbackIntervalRef.current = window.setInterval(() => {
        setState(prev => ({ ...prev, currentTime: prev.currentTime + beatsPerUpdate }));
      }, updateInterval);
    } else if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [state.isPlaying, state.bpm]);

  return {
    state,
    createTrack,
    setActiveTrack,
    addNote,
    addTrigger,
    deleteNote,
    deleteTrigger,
    updateNote,
    addSampleMapping,
    setSnapGrid,
    setZoom,
    togglePlayback,
    stopPlayback,
    setCurrentTime,
    selectNotes,
    clearSelection,
    snapToGrid,
  };
};
