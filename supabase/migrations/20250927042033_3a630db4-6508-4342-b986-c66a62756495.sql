-- Fix Cook Mode session creation by replacing recursive RLS with SECURITY DEFINER helpers and minimal safe policies

-- Ensure RLS is enabled on involved tables
alter table if exists public.collaboration_projects enable row level security;
alter table if exists public.collaboration_members enable row level security;

-- Create helper functions that bypass RLS safely using SECURITY DEFINER
create or replace function public.is_collab_member(_collab_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.collaboration_members cm
    where cm.collaboration_id = _collab_id
      and cm.user_id = _user_id
      and cm.status = 'accepted'
  );
$$;

create or replace function public.is_project_owner(_project_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.collaboration_projects p
    where p.id = _project_id
      and p.created_by = _user_id
  );
$$;

-- Drop existing policies on collaboration_projects to avoid recursion/conflicts
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname='public' AND tablename='collaboration_projects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.collaboration_projects', pol.policyname);
  END LOOP;
END $$;

-- Minimal, safe policies for collaboration_projects
create policy cp_select_owner_or_member
on public.collaboration_projects
for select
using (
  public.is_project_owner(id, auth.uid())
  OR public.is_collab_member(id, auth.uid())
);

create policy cp_insert_owner_self
on public.collaboration_projects
for insert
with check (
  created_by = auth.uid()
);

-- Drop existing policies on collaboration_members to avoid recursion
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname='public' AND tablename='collaboration_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.collaboration_members', pol.policyname);
  END LOOP;
END $$;

-- Minimal, safe policies for collaboration_members
create policy cm_select_owner_or_member
on public.collaboration_members
for select
using (
  public.is_collab_member(collaboration_id, auth.uid())
  OR public.is_project_owner(collaboration_id, auth.uid())
);

-- Allow only the project owner to create membership rows (covers initial self-membership on session create)
create policy cm_insert_owner_only
on public.collaboration_members
for insert
with check (
  public.is_project_owner(collaboration_id, auth.uid())
);
