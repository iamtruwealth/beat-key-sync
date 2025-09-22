-- Create stems table to store audio stems linked to beats
CREATE TABLE public.stems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  beat_id UUID NOT NULL REFERENCES public.beats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  duration NUMERIC,
  format TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stems ENABLE ROW LEVEL SECURITY;

-- Create policies for stems
CREATE POLICY "Users can view their own stems" 
ON public.stems 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own stems" 
ON public.stems 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stems" 
ON public.stems 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stems" 
ON public.stems 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_stems_updated_at
BEFORE UPDATE ON public.stems
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_stems_beat_id ON public.stems(beat_id);
CREATE INDEX idx_stems_user_id ON public.stems(user_id);