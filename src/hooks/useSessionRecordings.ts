import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AudioRecording {
  id: string;
  session_id: string;
  track_id: string | null;
  user_id: string;
  file_url: string;
  file_name: string;
  duration: number | null;
  file_size: number | null;
  sample_rate: number | null;
  format: string | null;
  is_used_in_session: boolean;
  is_outtake: boolean;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export const useSessionRecordings = (sessionId: string) => {
  const [recordings, setRecordings] = useState<AudioRecording[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRecordings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('session_audio_recordings')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecordings(data || []);
    } catch (error) {
      console.error('Error loading recordings:', error);
      toast.error('Failed to load recordings');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const saveRecording = useCallback(async (
    blob: Blob,
    metadata: {
      trackId?: string;
      trackName?: string;
      duration?: number;
      sampleRate?: number;
      format?: string;
    }
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload to storage
      const fileName = `recording-${Date.now()}-${metadata.trackName || 'untitled'}.webm`;
      const filePath = `${sessionId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(filePath, blob, {
          contentType: metadata.format || 'audio/webm',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('audio-files')
        .getPublicUrl(filePath);

      // Save to database
      const { data, error: dbError } = await supabase
        .from('session_audio_recordings')
        .insert({
          session_id: sessionId,
          track_id: metadata.trackId,
          user_id: user.id,
          file_url: publicUrl,
          file_name: fileName,
          duration: metadata.duration,
          file_size: blob.size,
          sample_rate: metadata.sampleRate,
          format: metadata.format,
          metadata: metadata
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setRecordings(prev => [data, ...prev]);
      toast.success('Recording saved successfully');
      return data;
    } catch (error) {
      console.error('Error saving recording:', error);
      toast.error('Failed to save recording');
      throw error;
    }
  }, [sessionId]);

  const deleteRecording = useCallback(async (recordingId: string) => {
    try {
      const recording = recordings.find(r => r.id === recordingId);
      if (!recording) return;

      // Delete from storage
      const filePath = recording.file_url.split('/audio-files/')[1];
      if (filePath) {
        await supabase.storage
          .from('audio-files')
          .remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from('session_audio_recordings')
        .delete()
        .eq('id', recordingId);

      if (error) throw error;

      setRecordings(prev => prev.filter(r => r.id !== recordingId));
      toast.success('Recording deleted');
    } catch (error) {
      console.error('Error deleting recording:', error);
      toast.error('Failed to delete recording');
    }
  }, [recordings]);

  const toggleOuttake = useCallback(async (recordingId: string, isOuttake: boolean) => {
    try {
      const { error } = await supabase
        .from('session_audio_recordings')
        .update({ 
          is_outtake: isOuttake,
          is_used_in_session: !isOuttake 
        })
        .eq('id', recordingId);

      if (error) throw error;

      setRecordings(prev =>
        prev.map(r =>
          r.id === recordingId
            ? { ...r, is_outtake: isOuttake, is_used_in_session: !isOuttake }
            : r
        )
      );
      
      toast.success(isOuttake ? 'Marked as outtake' : 'Marked as used in session');
    } catch (error) {
      console.error('Error toggling outtake:', error);
      toast.error('Failed to update recording');
    }
  }, []);

  return {
    recordings,
    loading,
    loadRecordings,
    saveRecording,
    deleteRecording,
    toggleOuttake
  };
};
