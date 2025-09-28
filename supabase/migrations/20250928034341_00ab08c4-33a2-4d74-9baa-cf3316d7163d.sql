-- Enable RLS on collaboration_projects table since it was missing
-- This is the specific table that was causing the collaboration loading issues

ALTER TABLE collaboration_projects ENABLE ROW LEVEL SECURITY;