-- Create table for storing piano roll triggers/notes
CREATE TABLE IF NOT EXISTS public.track_midi_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  pitch INTEGER NOT NULL CHECK (pitch >= 0 AND pitch <= 127),
  start_time DECIMAL NOT NULL CHECK (start_time >= 0),
  duration DECIMAL NOT NULL CHECK (duration > 0),
  velocity INTEGER NOT NULL DEFAULT 100 CHECK (velocity >= 0 AND velocity <= 127),
  note_type TEXT NOT NULL DEFAULT 'trigger' CHECK (note_type IN ('trigger', 'note')),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.track_midi_notes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own midi notes"
  ON public.track_midi_notes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own midi notes"
  ON public.track_midi_notes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own midi notes"
  ON public.track_midi_notes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own midi notes"
  ON public.track_midi_notes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_track_midi_notes_track ON public.track_midi_notes(track_id, user_id);
CREATE INDEX idx_track_midi_notes_time ON public.track_midi_notes(start_time);