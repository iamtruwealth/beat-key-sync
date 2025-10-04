import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PianoRollNote, SampleTrigger } from '@/types/pianoRoll';

interface SaveNoteParams {
  trackId: string;
  sessionId: string;
  note: {
    pitch: number;
    startTime: number;
    duration: number;
    velocity: number;
  };
  noteType: 'trigger' | 'note';
}

export const usePianoRollPersistence = (trackId: string, sessionId: string) => {
  // Load existing notes from database
  const loadNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('track_midi_notes')
      .select('*')
      .eq('track_id', trackId)
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error loading piano roll notes:', error);
      return [];
    }

    return data || [];
  }, [trackId, sessionId]);

  // Save a note to database (without ID since DB creates it)
  const saveNote = useCallback(async ({ trackId, sessionId, note, noteType }: SaveNoteParams) => {
    const { error } = await supabase
      .from('track_midi_notes')
      .upsert({
        track_id: trackId,
        session_id: sessionId,
        pitch: note.pitch,
        start_time: note.startTime,
        duration: note.duration,
        velocity: note.velocity,
        note_type: noteType,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      }, {
        onConflict: 'track_id,session_id,pitch,start_time',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Error saving piano roll note:', error);
    }
  }, []);

  // Delete a note from database
  const deleteNote = useCallback(async (pitch: number, startTime: number) => {
    const { error } = await supabase
      .from('track_midi_notes')
      .delete()
      .eq('track_id', trackId)
      .eq('session_id', sessionId)
      .eq('pitch', pitch)
      .eq('start_time', startTime);

    if (error) {
      console.error('Error deleting piano roll note:', error);
    }
  }, [trackId, sessionId]);

  // Clear all notes for this track
  const clearNotes = useCallback(async () => {
    const { error } = await supabase
      .from('track_midi_notes')
      .delete()
      .eq('track_id', trackId)
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error clearing piano roll notes:', error);
    }
  }, [trackId, sessionId]);

  return {
    loadNotes,
    saveNote,
    deleteNote,
    clearNotes,
  };
};
