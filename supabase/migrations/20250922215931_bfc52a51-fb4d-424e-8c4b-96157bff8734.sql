-- Fix critical security issue: Secure beat_sales table with proper RLS policies
-- Currently only has SELECT policy for producers, missing INSERT/UPDATE/DELETE policies

-- Add policy to allow only edge functions (service role) to insert sales records
CREATE POLICY "Only service role can insert beat sales"
ON public.beat_sales
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Add policy to allow buyers to view their own purchase records
CREATE POLICY "Buyers can view their own purchases"
ON public.beat_sales  
FOR SELECT
USING (buyer_email = (auth.jwt() ->> 'email'));

-- Prevent unauthorized updates to sales records
CREATE POLICY "No updates allowed to beat sales"
ON public.beat_sales
FOR UPDATE
USING (false);

-- Prevent unauthorized deletions of sales records  
CREATE POLICY "No deletions allowed to beat sales"
ON public.beat_sales
FOR DELETE
USING (false);

-- Fix database function security: Update functions to use SECURITY DEFINER with proper search_path
CREATE OR REPLACE FUNCTION public.increment_beat_and_pack_download_count(beat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.increment_beat_play_count(beat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE beats 
  SET play_count = COALESCE(play_count, 0) + 1
  WHERE id = beat_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_beat_download_count(beat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE beats 
  SET download_count = COALESCE(download_count, 0) + 1
  WHERE id = beat_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_beat_pack_play_count(pack_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE beat_packs 
  SET play_count = COALESCE(play_count, 0) + 1
  WHERE id = pack_id;
END;
$function$;

-- Secure the payout_requests table with additional validation
CREATE POLICY "Only valid payout methods allowed"
ON public.payout_requests
FOR INSERT
WITH CHECK (
  auth.uid() = producer_id AND
  payout_method IN ('paypal', 'bank_transfer', 'stripe', 'cashapp', 'venmo', 'zelle') AND
  amount_cents > 0 AND
  amount_cents <= (
    SELECT available_balance_cents 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

-- Secure user_payment_info table - prevent unauthorized access to payment data
CREATE POLICY "No direct access to payment info"
ON public.user_payment_info
FOR SELECT
USING (auth.uid() = user_id AND auth.role() != 'anon');