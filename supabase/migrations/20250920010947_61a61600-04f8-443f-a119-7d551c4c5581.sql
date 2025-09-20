-- Create table to curate featured beat packs
CREATE TABLE IF NOT EXISTS public.featured_beat_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_pack_id uuid NOT NULL REFERENCES public.beat_packs(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  added_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(beat_pack_id)
);

-- Enable RLS
ALTER TABLE public.featured_beat_packs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view featured beat packs"
  ON public.featured_beat_packs FOR SELECT
  USING (true);

CREATE POLICY "Only master can insert featured packs"
  ON public.featured_beat_packs FOR INSERT
  WITH CHECK ((current_setting('request.jwt.claims', true)::json ->> 'email') = 'iamtruwealth@gmail.com');

CREATE POLICY "Only master can update featured packs"
  ON public.featured_beat_packs FOR UPDATE
  USING ((current_setting('request.jwt.claims', true)::json ->> 'email') = 'iamtruwealth@gmail.com');

CREATE POLICY "Only master can delete featured packs"
  ON public.featured_beat_packs FOR DELETE
  USING ((current_setting('request.jwt.claims', true)::json ->> 'email') = 'iamtruwealth@gmail.com');