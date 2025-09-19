-- Create a separate table for payment information with enhanced security
CREATE TABLE public.user_payment_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on the payment info table
ALTER TABLE public.user_payment_info ENABLE ROW LEVEL SECURITY;

-- Create strict RLS policies for payment information
-- Users can only access their own payment info
CREATE POLICY "Users can view their own payment info" 
ON public.user_payment_info 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment info" 
ON public.user_payment_info 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment info" 
ON public.user_payment_info 
FOR UPDATE 
USING (auth.uid() = user_id);

-- No DELETE policy - payment records should be preserved for audit purposes

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_payment_info_updated_at
BEFORE UPDATE ON public.user_payment_info
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing stripe_customer_id data from profiles to payment_info table
INSERT INTO public.user_payment_info (user_id, stripe_customer_id, created_at, updated_at)
SELECT id, stripe_customer_id, created_at, updated_at 
FROM public.profiles 
WHERE stripe_customer_id IS NOT NULL;

-- Remove the stripe_customer_id column from profiles table
ALTER TABLE public.profiles DROP COLUMN stripe_customer_id;