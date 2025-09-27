-- Create collaboration tables for the full collaboration feature suite

-- Collaboration projects table
CREATE TABLE public.collaboration_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cover_art_url TEXT,
  joint_artist_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL,
  workspace_type TEXT NOT NULL DEFAULT 'beat_pack',
  target_genre TEXT,
  target_bpm INTEGER,
  invite_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Collaboration members table
CREATE TABLE public.collaboration_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaboration_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'collaborator',
  royalty_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'pending',
  joined_at TIMESTAMP WITH TIME ZONE,
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(collaboration_id, user_id)
);

-- Collaboration stems table
CREATE TABLE public.collaboration_stems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaboration_id UUID NOT NULL,
  uploaded_by UUID NOT NULL,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  stem_type TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  duration NUMERIC,
  file_size BIGINT,
  format TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Collaboration messages/chat table
CREATE TABLE public.collaboration_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaboration_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Collaboration requests/matchmaking table
CREATE TABLE public.collaboration_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  genre_tags TEXT[] DEFAULT '{}',
  looking_for TEXT NOT NULL,
  sample_beat_url TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Collaboration request applications table
CREATE TABLE public.collaboration_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL,
  applicant_id UUID NOT NULL,
  message TEXT,
  sample_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Collaboration analytics table
CREATE TABLE public.collaboration_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaboration_id UUID NOT NULL,
  member_id UUID NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value INTEGER NOT NULL DEFAULT 0,
  referral_source TEXT,
  tracked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Royalty share marketplace table
CREATE TABLE public.royalty_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaboration_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  percentage_for_sale NUMERIC(5,2) NOT NULL,
  asking_price_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  buyer_id UUID,
  sold_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Live session records table
CREATE TABLE public.collaboration_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaboration_id UUID NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'cook_mode',
  started_by UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  recording_url TEXT,
  export_url TEXT,
  participants UUID[] DEFAULT '{}'
);

-- Enable RLS on all tables
ALTER TABLE public.collaboration_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_stems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalty_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for collaboration_projects
CREATE POLICY "Users can create collaboration projects" 
ON public.collaboration_projects 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Members can view their collaboration projects" 
ON public.collaboration_projects 
FOR SELECT 
USING (
  auth.uid() = created_by OR 
  EXISTS (
    SELECT 1 FROM public.collaboration_members 
    WHERE collaboration_id = id AND user_id = auth.uid() AND status = 'accepted'
  )
);

CREATE POLICY "Project creators can update their projects" 
ON public.collaboration_projects 
FOR UPDATE 
USING (auth.uid() = created_by);

-- RLS Policies for collaboration_members
CREATE POLICY "Project creators can manage members" 
ON public.collaboration_members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.collaboration_projects 
    WHERE id = collaboration_id AND created_by = auth.uid()
  )
);

CREATE POLICY "Members can view collaboration members" 
ON public.collaboration_members 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.collaboration_projects 
    WHERE id = collaboration_id AND 
    (created_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.collaboration_members cm2 
      WHERE cm2.collaboration_id = collaboration_id AND cm2.user_id = auth.uid() AND cm2.status = 'accepted'
    ))
  )
);

CREATE POLICY "Users can update their own membership status" 
ON public.collaboration_members 
FOR UPDATE 
USING (user_id = auth.uid());

-- RLS Policies for collaboration_stems
CREATE POLICY "Members can manage stems" 
ON public.collaboration_stems 
FOR ALL 
USING (
  uploaded_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.collaboration_members 
    WHERE collaboration_id = collaboration_stems.collaboration_id AND user_id = auth.uid() AND status = 'accepted'
  )
);

-- RLS Policies for collaboration_messages
CREATE POLICY "Members can manage messages" 
ON public.collaboration_messages 
FOR ALL 
USING (
  sender_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.collaboration_members 
    WHERE collaboration_id = collaboration_messages.collaboration_id AND user_id = auth.uid() AND status = 'accepted'
  )
);

-- RLS Policies for collaboration_requests
CREATE POLICY "Anyone can view open collaboration requests" 
ON public.collaboration_requests 
FOR SELECT 
USING (status = 'open' OR requester_id = auth.uid());

CREATE POLICY "Users can create collaboration requests" 
ON public.collaboration_requests 
FOR INSERT 
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update their own requests" 
ON public.collaboration_requests 
FOR UPDATE 
USING (auth.uid() = requester_id);

-- RLS Policies for collaboration_applications
CREATE POLICY "Request owners and applicants can view applications" 
ON public.collaboration_applications 
FOR SELECT 
USING (
  applicant_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.collaboration_requests 
    WHERE id = request_id AND requester_id = auth.uid()
  )
);

CREATE POLICY "Users can create applications" 
ON public.collaboration_applications 
FOR INSERT 
WITH CHECK (auth.uid() = applicant_id);

-- RLS Policies for collaboration_analytics
CREATE POLICY "Members can view collaboration analytics" 
ON public.collaboration_analytics 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.collaboration_members 
    WHERE collaboration_id = collaboration_analytics.collaboration_id AND user_id = auth.uid() AND status = 'accepted'
  )
);

CREATE POLICY "Members can create analytics entries" 
ON public.collaboration_analytics 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.collaboration_members 
    WHERE collaboration_id = collaboration_analytics.collaboration_id AND user_id = auth.uid() AND status = 'accepted'
  )
);

-- RLS Policies for royalty_shares
CREATE POLICY "Anyone can view available royalty shares" 
ON public.royalty_shares 
FOR SELECT 
USING (status = 'available' OR seller_id = auth.uid() OR buyer_id = auth.uid());

CREATE POLICY "Members can create royalty shares" 
ON public.royalty_shares 
FOR INSERT 
WITH CHECK (
  auth.uid() = seller_id AND 
  EXISTS (
    SELECT 1 FROM public.collaboration_members 
    WHERE collaboration_id = royalty_shares.collaboration_id AND user_id = auth.uid() AND status = 'accepted'
  )
);

-- RLS Policies for collaboration_sessions
CREATE POLICY "Members can manage sessions" 
ON public.collaboration_sessions 
FOR ALL 
USING (
  started_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.collaboration_members 
    WHERE collaboration_id = collaboration_sessions.collaboration_id AND user_id = auth.uid() AND status = 'accepted'
  )
);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_collaboration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_collaboration_projects_updated_at
  BEFORE UPDATE ON public.collaboration_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_collaboration_updated_at();