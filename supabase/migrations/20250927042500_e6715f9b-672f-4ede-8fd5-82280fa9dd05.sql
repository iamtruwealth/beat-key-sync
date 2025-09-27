-- Simplify to basic policy and ensure user can insert projects

-- Drop current restrictive policy
DROP POLICY IF EXISTS cp_insert_auth_users ON public.collaboration_projects;

-- Create most basic authenticated insert policy
CREATE POLICY cp_basic_insert
ON public.collaboration_projects
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also add UPDATE/DELETE for completeness
CREATE POLICY cp_update_owner
ON public.collaboration_projects
FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY cp_delete_owner
ON public.collaboration_projects  
FOR DELETE
TO authenticated
USING (created_by = auth.uid());