-- Add public_access field to collaboration_projects to enable sharing
ALTER TABLE public.collaboration_projects 
ADD COLUMN allow_public_access boolean DEFAULT false;

-- Update the RLS policy to allow public access when enabled
DROP POLICY IF EXISTS "cp_select_owner_or_member" ON public.collaboration_projects;

CREATE POLICY "cp_select_owner_member_or_public" 
ON public.collaboration_projects 
FOR SELECT 
USING (
  is_project_owner(id, auth.uid()) 
  OR is_collab_member(id, auth.uid()) 
  OR (allow_public_access = true AND auth.uid() IS NOT NULL)
);

-- Create a function to enable public access when a session link is shared
CREATE OR REPLACE FUNCTION public.enable_session_sharing(session_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.collaboration_projects
  SET allow_public_access = true
  WHERE id = session_id 
    AND created_by = auth.uid()
  RETURNING true;
$$;