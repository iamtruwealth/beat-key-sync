-- Create tables to track beat pack views and downloads
CREATE TABLE IF NOT EXISTS public.beat_pack_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  beat_pack_id uuid NOT NULL REFERENCES public.beat_packs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address inet,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.beat_pack_downloads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  beat_pack_id uuid NOT NULL REFERENCES public.beat_packs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address inet,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.beat_pack_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beat_pack_downloads ENABLE ROW LEVEL SECURITY;

-- Create policies for beat pack views
CREATE POLICY "Anyone can view beat pack views for public packs"
ON public.beat_pack_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.beat_packs bp
    WHERE bp.id = beat_pack_views.beat_pack_id
    AND (bp.is_public = true OR bp.user_id = auth.uid())
  )
);

CREATE POLICY "Anyone can create beat pack views"
ON public.beat_pack_views
FOR INSERT
WITH CHECK (true);

-- Create policies for beat pack downloads
CREATE POLICY "Anyone can view beat pack downloads for public packs"
ON public.beat_pack_downloads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.beat_packs bp
    WHERE bp.id = beat_pack_downloads.beat_pack_id
    AND (bp.is_public = true OR bp.user_id = auth.uid())
  )
);

CREATE POLICY "Users can create beat pack downloads for enabled packs"
ON public.beat_pack_downloads
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.beat_packs bp
    WHERE bp.id = beat_pack_downloads.beat_pack_id
    AND bp.download_enabled = true
    AND bp.is_public = true
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_beat_pack_views_pack_id ON public.beat_pack_views(beat_pack_id);
CREATE INDEX IF NOT EXISTS idx_beat_pack_views_created_at ON public.beat_pack_views(created_at);
CREATE INDEX IF NOT EXISTS idx_beat_pack_downloads_pack_id ON public.beat_pack_downloads(beat_pack_id);
CREATE INDEX IF NOT EXISTS idx_beat_pack_downloads_created_at ON public.beat_pack_downloads(created_at);