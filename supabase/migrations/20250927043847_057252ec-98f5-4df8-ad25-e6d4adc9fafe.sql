-- Relax INSERT check to allow trigger to set owner
DROP POLICY IF EXISTS "Users can create their own collaboration projects" ON public.collaboration_projects;

CREATE POLICY "Users can create collaboration projects (owner via trigger)"
ON public.collaboration_projects
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid() OR created_by IS NULL
);

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS set_project_owner_trigger ON public.collaboration_projects;
CREATE TRIGGER set_project_owner_trigger
  BEFORE INSERT ON public.collaboration_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_owner();