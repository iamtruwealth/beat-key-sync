-- Add RLS policies to allow viewing collaboration invitations and notifications
-- Update collaboration_members policies to handle invitations

-- Allow users to view notifications sent to them
CREATE POLICY "Users can insert notifications for others" 
ON public.notifications 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Update collaboration_members policy to allow invited status
-- First, let's add a policy for viewing invited members
CREATE POLICY "cm_select_invited_members" 
ON public.collaboration_members 
FOR SELECT 
USING (status = 'invited' AND user_id = auth.uid());

-- Add policy for updating invitation status (accepting/declining)
CREATE POLICY "cm_update_invitation_response" 
ON public.collaboration_members 
FOR UPDATE 
USING (status = 'invited' AND user_id = auth.uid())
WITH CHECK (status IN ('accepted', 'declined') AND user_id = auth.uid());