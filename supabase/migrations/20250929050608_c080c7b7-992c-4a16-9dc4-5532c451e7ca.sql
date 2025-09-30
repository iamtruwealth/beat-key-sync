-- Update projects SELECT policy to allow public access without auth
DROP POLICY IF EXISTS "cp_select_owner_member_or_public" ON public.collaboration_projects;
CREATE POLICY "cp_select_owner_member_or_public" 
ON public.collaboration_projects 
FOR SELECT 
USING (
  is_project_owner(id, auth.uid()) 
  OR is_collab_member(id, auth.uid()) 
  OR allow_public_access = true
);

-- Allow public SELECT on stems when parent project is public
DROP POLICY IF EXISTS "stems_public_select" ON public.collaboration_stems;
CREATE POLICY "stems_public_select"
ON public.collaboration_stems
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.collaboration_projects p
    WHERE p.id = collaboration_stems.collaboration_id
      AND p.allow_public_access = true
  )
);
