-- Make INSERT work reliably for any authenticated user by scoping policy to public with an auth check
DROP POLICY IF EXISTS "cp_insert_authenticated_trigger_owner" ON public.collaboration_projects;
DROP POLICY IF EXISTS "Users can create collaboration projects (owner via trigger)" ON public.collaboration_projects;
DROP POLICY IF EXISTS "cp_basic_insert" ON public.collaboration_projects;

CREATE POLICY "cp_insert_any_authed"
ON public.collaboration_projects
FOR INSERT
TO public
WITH CHECK (auth.uid() IS NOT NULL);

-- Keep trigger enforcing owner
DROP TRIGGER IF EXISTS set_project_owner_trigger ON public.collaboration_projects;
CREATE TRIGGER set_project_owner_trigger
  BEFORE INSERT ON public.collaboration_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_owner();