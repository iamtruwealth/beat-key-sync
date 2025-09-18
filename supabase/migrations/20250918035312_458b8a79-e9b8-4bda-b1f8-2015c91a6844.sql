-- Create tracks table for audio files
CREATE TABLE public.tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  duration NUMERIC,
  file_size BIGINT,
  format TEXT,
  sample_rate INTEGER,
  detected_key TEXT,
  detected_bpm NUMERIC,
  manual_key TEXT,
  manual_bpm NUMERIC,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  stems TEXT[] DEFAULT '{}',
  waveform_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create beat_packs table
CREATE TABLE public.beat_packs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  artwork_url TEXT,
  is_public BOOLEAN DEFAULT true,
  creation_type TEXT CHECK (creation_type IN ('manual', 'auto_tag')) DEFAULT 'manual',
  auto_tag TEXT,
  track_order UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create beat_pack_tracks junction table for manual beat packs
CREATE TABLE public.beat_pack_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  beat_pack_id UUID NOT NULL REFERENCES public.beat_packs(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(beat_pack_id, track_id)
);

-- Enable Row Level Security
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beat_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beat_pack_tracks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tracks
CREATE POLICY "Users can view all public tracks" 
ON public.tracks FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own tracks" 
ON public.tracks FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tracks" 
ON public.tracks FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tracks" 
ON public.tracks FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for beat_packs
CREATE POLICY "Users can view public beat packs" 
ON public.beat_packs FOR SELECT 
USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can create their own beat packs" 
ON public.beat_packs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own beat packs" 
ON public.beat_packs FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own beat packs" 
ON public.beat_packs FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for beat_pack_tracks
CREATE POLICY "Users can view beat pack tracks for public packs" 
ON public.beat_pack_tracks FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.beat_packs bp 
  WHERE bp.id = beat_pack_id 
  AND (bp.is_public = true OR bp.user_id = auth.uid())
));

CREATE POLICY "Users can manage their own beat pack tracks" 
ON public.beat_pack_tracks FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.beat_packs bp 
  WHERE bp.id = beat_pack_id 
  AND bp.user_id = auth.uid()
));

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-files', 'audio-files', false);

-- Storage policies for audio files
CREATE POLICY "Users can upload their own audio files" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view audio files" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'audio-files');

CREATE POLICY "Users can update their own audio files" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own audio files" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage bucket for artwork
INSERT INTO storage.buckets (id, name, public) VALUES ('artwork', 'artwork', true);

-- Storage policies for artwork
CREATE POLICY "Anyone can view artwork" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'artwork');

CREATE POLICY "Users can upload artwork" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'artwork' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own artwork" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'artwork' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own artwork" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'artwork' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create indexes for better performance
CREATE INDEX idx_tracks_user_id ON public.tracks(user_id);
CREATE INDEX idx_tracks_tags ON public.tracks USING GIN(tags);
CREATE INDEX idx_tracks_key ON public.tracks(COALESCE(manual_key, detected_key));
CREATE INDEX idx_tracks_bpm ON public.tracks(COALESCE(manual_bpm, detected_bpm));
CREATE INDEX idx_beat_packs_user_id ON public.beat_packs(user_id);
CREATE INDEX idx_beat_packs_public ON public.beat_packs(is_public);
CREATE INDEX idx_beat_pack_tracks_beat_pack_id ON public.beat_pack_tracks(beat_pack_id);
CREATE INDEX idx_beat_pack_tracks_position ON public.beat_pack_tracks(beat_pack_id, position);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_tracks_updated_at
  BEFORE UPDATE ON public.tracks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_beat_packs_updated_at
  BEFORE UPDATE ON public.beat_packs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();