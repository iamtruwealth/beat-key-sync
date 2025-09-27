-- Ensure project owner is always the current user via trigger
CREATE OR REPLACE FUNCTION public.set_project_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  -- Always enforce owner as the authenticated user
  NEW.created_by := auth.uid();
  return NEW;
end;
$$;

-- Replace INSERT policy to allow insert; trigger enforces ownership
DROP POLICY IF EXISTS "Users can create collaboration projects (owner via trigger)" ON public.collaboration_projects;
DROP POLICY IF EXISTS "cp_insert_authenticated_trigger_owner" ON public.collaboration_projects;

CREATE POLICY "cp_insert_authenticated_trigger_owner"
ON public.collaboration_projects
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Recreate trigger to ensure it points to the updated function
DROP TRIGGER IF EXISTS set_project_owner_trigger ON public.collaboration_projects;
CREATE TRIGGER set_project_owner_trigger
  BEFORE INSERT ON public.collaboration_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_owner();