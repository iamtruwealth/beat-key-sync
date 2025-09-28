-- Add missing foreign key constraints to fix collaboration data loading issues
-- These will ensure proper relationships between tables for collaboration functionality

-- Add foreign key from collaboration_members to collaboration_projects
ALTER TABLE collaboration_members 
ADD CONSTRAINT fk_collaboration_members_collaboration_id 
FOREIGN KEY (collaboration_id) REFERENCES collaboration_projects(id) ON DELETE CASCADE;

-- Add foreign key from collaboration_requests to profiles (requester)
ALTER TABLE collaboration_requests 
ADD CONSTRAINT collaboration_requests_requester_id_fkey 
FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Add foreign key from collaboration_stems to collaboration_projects
ALTER TABLE collaboration_stems 
ADD CONSTRAINT fk_collaboration_stems_collaboration_id 
FOREIGN KEY (collaboration_id) REFERENCES collaboration_projects(id) ON DELETE CASCADE;

-- Add foreign key from collaboration_stems to profiles (uploader)
ALTER TABLE collaboration_stems 
ADD CONSTRAINT fk_collaboration_stems_uploaded_by 
FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE CASCADE;

-- Add foreign key from collaboration_sessions to collaboration_projects
ALTER TABLE collaboration_sessions 
ADD CONSTRAINT fk_collaboration_sessions_collaboration_id 
FOREIGN KEY (collaboration_id) REFERENCES collaboration_projects(id) ON DELETE CASCADE;

-- Add foreign key from collaboration_sessions to profiles (starter)
ALTER TABLE collaboration_sessions 
ADD CONSTRAINT fk_collaboration_sessions_started_by 
FOREIGN KEY (started_by) REFERENCES profiles(id) ON DELETE CASCADE;

-- Add foreign key from collaboration_messages to collaboration_projects
ALTER TABLE collaboration_messages 
ADD CONSTRAINT fk_collaboration_messages_collaboration_id 
FOREIGN KEY (collaboration_id) REFERENCES collaboration_projects(id) ON DELETE CASCADE;

-- Add foreign key from collaboration_messages to profiles (sender)
ALTER TABLE collaboration_messages 
ADD CONSTRAINT fk_collaboration_messages_sender_id 
FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Add foreign key from collaboration_analytics to collaboration_projects
ALTER TABLE collaboration_analytics 
ADD CONSTRAINT fk_collaboration_analytics_collaboration_id 
FOREIGN KEY (collaboration_id) REFERENCES collaboration_projects(id) ON DELETE CASCADE;

-- Add foreign key from collaboration_analytics to profiles (member)
ALTER TABLE collaboration_analytics 
ADD CONSTRAINT fk_collaboration_analytics_member_id 
FOREIGN KEY (member_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Ensure collaboration_projects has proper constraint on created_by
ALTER TABLE collaboration_projects 
ADD CONSTRAINT fk_collaboration_projects_created_by 
FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;