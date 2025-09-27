-- Security Fix Phase 2: Address Linter Warnings
-- 1. Fix function search_path issues - update all functions to have proper search_path
CREATE OR REPLACE FUNCTION public.update_cart_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_notification(target_user_id uuid, notification_type text, notification_message text, notification_item_id uuid DEFAULT NULL::uuid, notification_actor_id uuid DEFAULT NULL::uuid)
RETURNS uuid
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

CREATE OR REPLACE FUNCTION public.increment_beat_play_count(beat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE beats 
  SET play_count = COALESCE(play_count, 0) + 1
  WHERE id = beat_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_beat_download_count(beat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE beats 
  SET download_count = COALESCE(download_count, 0) + 1
  WHERE id = beat_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_beat_pack_play_count(pack_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE beat_packs 
  SET play_count = COALESCE(play_count, 0) + 1
  WHERE id = pack_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_username_availability(username_param text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE username = username_param
  );
$$;

CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS trigger
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

CREATE OR REPLACE FUNCTION public.update_user_verification(user_id_param uuid, verification_status_param text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_email text;
BEGIN
  -- Get the email of the requesting user
  SELECT email INTO admin_email
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Check if the requesting user is the master admin
  IF admin_email != 'iamtruwealth@gmail.com' THEN
    RAISE EXCEPTION 'Only the master admin can update verification status';
  END IF;
  
  -- Update the verification status
  UPDATE public.profiles
  SET 
    verification_status = verification_status_param,
    updated_at = now()
  WHERE id = user_id_param;
  
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_all_profiles_for_admin()
RETURNS TABLE(id uuid, username text, producer_name text, first_name text, last_name text, producer_logo_url text, verification_status text, role user_role, created_at timestamp with time zone, public_profile_enabled boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if the requesting user is the master admin
  SELECT 
    p.id,
    p.username,
    p.producer_name,
    p.first_name,
    p.last_name,
    p.producer_logo_url,
    p.verification_status,
    p.role,
    p.created_at,
    p.public_profile_enabled
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'iamtruwealth@gmail.com'
  )
  ORDER BY p.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.increment_beat_and_pack_download_count(beat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First increment the individual beat's download count
  UPDATE beats 
  SET download_count = COALESCE(download_count, 0) + 1
  WHERE id = beat_id;
  
  -- Then increment download count for all beat packs that contain this beat
  -- by inserting records into beat_pack_downloads table for tracking
  INSERT INTO beat_pack_downloads (beat_pack_id, user_id, ip_address)
  SELECT DISTINCT bpt.beat_pack_id, auth.uid(), NULL
  FROM beat_pack_tracks bpt
  WHERE bpt.track_id = beat_id;
  
  -- Note: The beat pack download counts are calculated via COUNT in queries
  -- so inserting records here will automatically increase the count
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_master_admin_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_email text;
BEGIN
  -- Get the email for this user ID
  SELECT email INTO admin_email
  FROM auth.users
  WHERE id = NEW.id;
  
  -- If this is the master admin, ensure they stay verified
  IF admin_email = 'iamtruwealth@gmail.com' THEN
    NEW.verification_status = 'verified';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_post_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts 
    SET likes = likes + 1 
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts 
    SET likes = likes - 1 
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_post_comments_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts 
    SET comments = comments + 1 
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts 
    SET comments = comments - 1 
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.signup_without_confirmation(email_param text, password_param text, username_param text, role_param text DEFAULT 'artist'::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id UUID;
  result JSON;
BEGIN
  -- This function will be called from an edge function
  -- that uses the service role to create users directly
  RETURN json_build_object(
    'success', true,
    'message', 'Please use the edge function for signup'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role, producer_logo_url, username)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'artist'),
    NEW.raw_user_meta_data ->> 'artist_logo',
    NEW.raw_user_meta_data ->> 'username'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_tracks()
RETURNS TABLE(id uuid, title text, file_url text, artwork_url text, duration numeric, detected_bpm numeric, manual_bpm numeric, detected_key text, manual_key text, tags text[], format text, sample_rate integer, file_size bigint, metadata jsonb, waveform_data jsonb, stems text[], created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.id,
    t.title,
    t.file_url,
    t.artwork_url,
    t.duration,
    t.detected_bpm,
    t.manual_bpm,
    t.detected_key,
    t.manual_key,
    t.tags,
    t.format,
    t.sample_rate,
    t.file_size,
    t.metadata,
    t.waveform_data,
    t.stems,
    t.created_at,
    t.updated_at
  FROM public.tracks t;
$$;