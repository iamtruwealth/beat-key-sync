-- Make collaboration_projects inserts succeed by defaulting created_by to auth.uid()

-- 1) Helper trigger to set owner on insert
create or replace function public.set_project_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.created_by is null then
    NEW.created_by := auth.uid();
  end if;
  return NEW;
end;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trg_set_project_owner ON public.collaboration_projects;
create trigger trg_set_project_owner
before insert on public.collaboration_projects
for each row
execute function public.set_project_owner();

-- 2) Relax INSERT policy to allow inserting with created_by null (trigger will set it)
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

create policy cp_insert_owner_self
on public.collaboration_projects
for insert
with check (
  created_by = auth.uid() OR created_by IS NULL
);
