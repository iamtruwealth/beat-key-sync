-- Broaden INSERT policy to any authenticated user; trigger enforces created_by
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'collaboration_projects' 
      AND policyname = 'cp_insert_owner_self'
  ) THEN
    DROP POLICY cp_insert_owner_self ON public.collaboration_projects;
  END IF;
END $$;

create policy cp_insert_auth_users
on public.collaboration_projects
for insert
with check (
  auth.uid() IS NOT NULL
);
