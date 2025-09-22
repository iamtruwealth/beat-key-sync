-- Create follows table for user relationships
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, followed_id),
  CONSTRAINT no_self_follow CHECK (follower_id != followed_id)
);

-- Enable RLS on follows table
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Create policies for follows table
CREATE POLICY "Users can view follows" 
ON public.follows 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create follows" 
ON public.follows 
FOR INSERT 
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete their own follows" 
ON public.follows 
FOR DELETE 
USING (auth.uid() = follower_id);

-- Update notifications table to add missing columns
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS item_id UUID,
ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS read_status BOOLEAN DEFAULT false;

-- Update read_status based on existing read_at column
UPDATE public.notifications 
SET read_status = (read_at IS NOT NULL) 
WHERE read_status IS NULL;

-- Add follower/following counts to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Create function to update follow counts
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment following count for follower
    UPDATE public.profiles 
    SET following_count = following_count + 1 
    WHERE id = NEW.follower_id;
    
    -- Increment followers count for followed user
    UPDATE public.profiles 
    SET followers_count = followers_count + 1 
    WHERE id = NEW.followed_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement following count for follower
    UPDATE public.profiles 
    SET following_count = following_count - 1 
    WHERE id = OLD.follower_id;
    
    -- Decrement followers count for followed user
    UPDATE public.profiles 
    SET followers_count = followers_count - 1 
    WHERE id = OLD.followed_id;
    
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger to update follow counts
DROP TRIGGER IF EXISTS update_follow_counts_trigger ON public.follows;
CREATE TRIGGER update_follow_counts_trigger
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();

-- Create function to create notifications
CREATE OR REPLACE FUNCTION public.create_notification(
  target_user_id UUID,
  notification_type TEXT,
  notification_message TEXT,
  notification_item_id UUID DEFAULT NULL,
  notification_actor_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, message, item_id, actor_id, title)
  VALUES (target_user_id, notification_type, notification_message, notification_item_id, notification_actor_id, 'New Notification')
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followed_id ON public.follows(followed_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_unread ON public.notifications(user_id) WHERE read_status = false;