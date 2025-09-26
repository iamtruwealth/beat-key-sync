-- Create onboarding guides table
CREATE TABLE public.onboarding_guides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role user_role NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create onboarding steps table
CREATE TABLE public.onboarding_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id UUID NOT NULL REFERENCES public.onboarding_guides(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  route TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(guide_id, step_number)
);

-- Create user onboarding progress table
CREATE TABLE public.user_onboarding_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guide_id UUID NOT NULL REFERENCES public.onboarding_guides(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1,
  completed_steps INTEGER[] NOT NULL DEFAULT '{}',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  is_skipped BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, guide_id)
);

-- Enable RLS
ALTER TABLE public.onboarding_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for onboarding_guides
CREATE POLICY "Anyone can view active guides" ON public.onboarding_guides 
FOR SELECT USING (is_active = true);

CREATE POLICY "Only admin can manage guides" ON public.onboarding_guides 
FOR ALL USING (
  (current_setting('request.jwt.claims', true)::json ->> 'email') = 'iamtruwealth@gmail.com'
);

-- RLS Policies for onboarding_steps
CREATE POLICY "Anyone can view active steps" ON public.onboarding_steps 
FOR SELECT USING (
  is_active = true AND 
  EXISTS (SELECT 1 FROM public.onboarding_guides WHERE id = guide_id AND is_active = true)
);

CREATE POLICY "Only admin can manage steps" ON public.onboarding_steps 
FOR ALL USING (
  (current_setting('request.jwt.claims', true)::json ->> 'email') = 'iamtruwealth@gmail.com'
);

-- RLS Policies for user_onboarding_progress
CREATE POLICY "Users can view their own progress" ON public.user_onboarding_progress 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own progress" ON public.user_onboarding_progress 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" ON public.user_onboarding_progress 
FOR UPDATE USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_onboarding_guides_updated_at
  BEFORE UPDATE ON public.onboarding_guides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_onboarding_steps_updated_at
  BEFORE UPDATE ON public.onboarding_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_onboarding_progress_updated_at
  BEFORE UPDATE ON public.user_onboarding_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default producer guide
INSERT INTO public.onboarding_guides (role, title, description) VALUES 
('producer', 'Producer Onboarding', 'Welcome to BeatPackz! Let''s get you started with creating and managing your beats.');

-- Get the guide ID for inserting steps
INSERT INTO public.onboarding_steps (guide_id, step_number, title, content, route) VALUES 
(
  (SELECT id FROM public.onboarding_guides WHERE role = 'producer' LIMIT 1),
  1,
  'Step 1 of 4 — Welcome to BeatPackz!',
  'Let''s get you started by creating your first Beat Pack. This is where you''ll organize and sell your beats.',
  '/beat-packs'
),
(
  (SELECT id FROM public.onboarding_guides WHERE role = 'producer' LIMIT 1),
  2,
  'Step 2 of 4 — Create Your First Beat Pack',
  'Click the "Create New Beat Pack" button to open the creation form. Give it a unique name and some artwork to make it stand out.',
  '/beat-packs'
),
(
  (SELECT id FROM public.onboarding_guides WHERE role = 'producer' LIMIT 1),
  3,
  'Step 3 of 4 — Upload Your First Beat',
  'Now that you have a Beat Pack, it''s time to upload your first beat. Drag and drop your audio file here to begin.',
  '/upload'
),
(
  (SELECT id FROM public.onboarding_guides WHERE role = 'producer' LIMIT 1),
  4,
  'Step 4 of 4 — You''re Ready to Start!',
  'Congratulations! You''ve created your first Beat Pack and uploaded a beat. You can now manage your beats, view analytics, and start selling.',
  '/producer-dashboard'
);