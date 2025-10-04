-- Create table for session audio recordings
CREATE TABLE IF NOT EXISTS public.session_audio_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.collaboration_projects(id) ON DELETE CASCADE,
  track_id UUID,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  duration NUMERIC,
  file_size BIGINT,
  sample_rate INTEGER,
  format TEXT,
  is_used_in_session BOOLEAN DEFAULT true,
  is_outtake BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for session MIDI recordings (recording takes/performances)
CREATE TABLE IF NOT EXISTS public.session_midi_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.collaboration_projects(id) ON DELETE CASCADE,
  track_id UUID,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_name TEXT NOT NULL,
  note_count INTEGER DEFAULT 0,
  is_used_in_session BOOLEAN DEFAULT true,
  is_outtake BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.session_audio_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_midi_recordings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for session_audio_recordings
CREATE POLICY "Users can view recordings from their sessions"
  ON public.session_audio_recordings
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.collaboration_members cm
      WHERE cm.collaboration_id = session_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1 FROM public.collaboration_projects cp
      WHERE cp.id = session_id
        AND cp.allow_public_access = true
    )
  );

CREATE POLICY "Users can create recordings in their sessions"
  ON public.session_audio_recordings
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.collaboration_projects cp
        WHERE cp.id = session_id
          AND cp.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.collaboration_members cm
        WHERE cm.collaboration_id = session_id
          AND cm.user_id = auth.uid()
          AND cm.status = 'accepted'
      )
    )
  );

CREATE POLICY "Users can update their own recordings"
  ON public.session_audio_recordings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recordings"
  ON public.session_audio_recordings
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for session_midi_recordings
CREATE POLICY "Users can view MIDI recordings from their sessions"
  ON public.session_midi_recordings
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.collaboration_members cm
      WHERE cm.collaboration_id = session_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1 FROM public.collaboration_projects cp
      WHERE cp.id = session_id
        AND cp.allow_public_access = true
    )
  );

CREATE POLICY "Users can create MIDI recordings in their sessions"
  ON public.session_midi_recordings
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.collaboration_projects cp
        WHERE cp.id = session_id
          AND cp.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.collaboration_members cm
        WHERE cm.collaboration_id = session_id
          AND cm.user_id = auth.uid()
          AND cm.status = 'accepted'
      )
    )
  );

CREATE POLICY "Users can update their own MIDI recordings"
  ON public.session_midi_recordings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own MIDI recordings"
  ON public.session_midi_recordings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX idx_session_audio_recordings_session ON public.session_audio_recordings(session_id);
CREATE INDEX idx_session_audio_recordings_user ON public.session_audio_recordings(user_id);
CREATE INDEX idx_session_midi_recordings_session ON public.session_midi_recordings(session_id);
CREATE INDEX idx_session_midi_recordings_user ON public.session_midi_recordings(user_id);

-- Add updated_at trigger
CREATE TRIGGER update_session_audio_recordings_updated_at
  BEFORE UPDATE ON public.session_audio_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_session_midi_recordings_updated_at
  BEFORE UPDATE ON public.session_midi_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();