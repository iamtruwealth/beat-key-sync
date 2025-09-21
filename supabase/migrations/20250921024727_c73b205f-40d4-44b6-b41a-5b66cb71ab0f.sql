-- Add new fields for enhanced functionality
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Add tracking fields for beats and beat packs
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS play_count INTEGER DEFAULT 0;
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;

ALTER TABLE public.beat_packs ADD COLUMN IF NOT EXISTS play_count INTEGER DEFAULT 0;

-- Create indexes for performance on ranking queries
CREATE INDEX IF NOT EXISTS idx_beats_play_count ON public.beats(play_count DESC);
CREATE INDEX IF NOT EXISTS idx_beats_download_count ON public.beats(download_count DESC);
CREATE INDEX IF NOT EXISTS idx_beat_packs_play_count ON public.beat_packs(play_count DESC);

-- Create cart_items table for shopping cart functionality
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('beat', 'beat_pack')),
  item_id UUID NOT NULL,
  quantity INTEGER DEFAULT 1,
  price_cents INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, item_type, item_id)
);

-- Enable RLS on cart_items
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Create policies for cart_items
CREATE POLICY "Users can manage their own cart items" 
ON public.cart_items 
FOR ALL 
USING (auth.uid() = user_id);

-- Create function to update cart_items updated_at
CREATE OR REPLACE FUNCTION public.update_cart_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cart_items
CREATE TRIGGER update_cart_items_updated_at_trigger
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cart_items_updated_at();