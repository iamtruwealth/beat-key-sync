-- Fix recursive/incorrect RLS policy on collaboration_projects and correct members view policy

-- 1) Drop problematic SELECT policy on collaboration_projects if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'collaboration_projects' 
      AND policyname = 'Members can view their collaboration projects'
  ) THEN
    DROP POLICY "Members can view their collaboration projects" ON public.collaboration_projects;
  END IF;
END$$;

-- 2) Recreate safe, non-recursive SELECT policy
CREATE POLICY "Members can view their collaboration projects"
ON public.collaboration_projects
FOR SELECT
USING (
  auth.uid() = created_by OR
  EXISTS (
    SELECT 1 
    FROM public.collaboration_members cm
    WHERE cm.collaboration_id = public.collaboration_projects.id
      AND cm.user_id = auth.uid()
      AND cm.status = 'accepted'
  )
);

-- 3) Correct the members view policy that referenced wrong columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'collaboration_members' 
      AND policyname = 'Members can view collaboration members'
  ) THEN
    DROP POLICY "Members can view collaboration members" ON public.collaboration_members;
  END IF;
END$$;

CREATE POLICY "Members can view collaboration members"
ON public.collaboration_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.collaboration_projects p
    WHERE p.id = public.collaboration_members.collaboration_id
      AND (
        p.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.collaboration_members cm2
          WHERE cm2.collaboration_id = public.collaboration_members.collaboration_id
            AND cm2.user_id = auth.uid()
            AND cm2.status = 'accepted'
        )
      )
  )
);
