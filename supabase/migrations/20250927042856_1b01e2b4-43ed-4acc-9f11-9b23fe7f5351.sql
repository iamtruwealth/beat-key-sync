-- Attach trigger to set created_by automatically on collaboration_projects
DO $$
BEGIN
  -- Create trigger only if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_collab_project_owner'
  ) THEN
    CREATE TRIGGER set_collab_project_owner
    BEFORE INSERT ON public.collaboration_projects
    FOR EACH ROW
    EXECUTE FUNCTION public.set_project_owner();
  END IF;
END $$;

-- Ensure a simple, permissive INSERT policy exists for authenticated users (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='collaboration_projects' AND policyname='cp_basic_insert'
  ) THEN
    CREATE POLICY cp_basic_insert
    ON public.collaboration_projects
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;
END $$;

-- Make sure creators can insert themselves as members (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='collaboration_members' AND policyname='cm_insert_owner_only'
  ) THEN
    CREATE POLICY cm_insert_owner_only
    ON public.collaboration_members
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_project_owner(collaboration_id, auth.uid()));
  END IF;
END $$;

-- Ensure stems policy allows owners/members to manage stems (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='collaboration_stems' AND policyname='Members can manage stems'
  ) THEN
    CREATE POLICY "Members can manage stems"
    ON public.collaboration_stems
    FOR ALL
    TO authenticated
    USING (
      uploaded_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.collaboration_members m
        WHERE m.collaboration_id = collaboration_stems.collaboration_id
          AND m.user_id = auth.uid()
          AND m.status = 'accepted'
      )
    );
  END IF;
END $$;