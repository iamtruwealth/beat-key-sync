-- Fix RLS policies for collaboration_projects to allow authenticated users to create sessions

-- First, drop the existing cp_basic_insert policy that might be causing issues
DROP POLICY IF EXISTS "cp_basic_insert" ON public.collaboration_projects;

-- Create a new policy that explicitly allows authenticated users to insert their own projects
CREATE POLICY "Users can create their own collaboration projects" 
ON public.collaboration_projects 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Also ensure the set_project_owner trigger is attached properly
DROP TRIGGER IF EXISTS set_project_owner_trigger ON public.collaboration_projects;

CREATE TRIGGER set_project_owner_trigger
  BEFORE INSERT ON public.collaboration_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_owner();