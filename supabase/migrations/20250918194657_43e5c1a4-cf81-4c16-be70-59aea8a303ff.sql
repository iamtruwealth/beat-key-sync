-- Add user roles enum and update profiles table
CREATE TYPE public.user_role AS ENUM ('artist', 'producer');

-- Add role column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN role public.user_role DEFAULT 'artist',
ADD COLUMN bio text,
ADD COLUMN social_links jsonb DEFAULT '{}',
ADD COLUMN verification_status text DEFAULT 'unverified',
ADD COLUMN public_profile_enabled boolean DEFAULT true;

-- Create messages table for direct messaging
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text DEFAULT 'text',
  file_url text,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create collab rooms table
CREATE TABLE public.collab_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create collab room members table
CREATE TABLE public.collab_room_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.collab_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Create notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  read_at timestamp with time zone,
  data jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create projects table for artists
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text DEFAULT 'demo',
  artwork_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for messages
CREATE POLICY "Users can view their own messages" 
ON public.messages FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages" 
ON public.messages FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own messages" 
ON public.messages FOR UPDATE 
USING (auth.uid() = sender_id);

-- Create RLS policies for collab rooms
CREATE POLICY "Users can view rooms they're members of" 
ON public.collab_rooms FOR SELECT 
USING (
  auth.uid() = created_by OR 
  EXISTS (
    SELECT 1 FROM public.collab_room_members 
    WHERE room_id = id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create collab rooms" 
ON public.collab_rooms FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Room creators can update rooms" 
ON public.collab_rooms FOR UPDATE 
USING (auth.uid() = created_by);

-- Create RLS policies for collab room members
CREATE POLICY "Users can view room members for their rooms" 
ON public.collab_room_members FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.collab_rooms 
    WHERE id = room_id AND (
      created_by = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.collab_room_members crm2 
        WHERE crm2.room_id = id AND crm2.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Room creators can manage members" 
ON public.collab_room_members FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.collab_rooms 
    WHERE id = room_id AND created_by = auth.uid()
  )
);

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
USING (auth.uid() = user_id);

-- Create RLS policies for projects
CREATE POLICY "Users can manage their own projects" 
ON public.projects FOR ALL 
USING (auth.uid() = user_id);

-- Create triggers for updated_at columns
CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_collab_rooms_updated_at
BEFORE UPDATE ON public.collab_rooms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();