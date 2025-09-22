-- Create storage policies for posts in audio-files bucket
-- Allow users to upload posts to their own folder
CREATE POLICY "Users can upload posts to their own folder" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'audio-files' 
  AND (storage.foldername(name))[1] = 'posts'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow users to view posts (needed for public access)
CREATE POLICY "Posts are publicly viewable" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'audio-files' 
  AND (storage.foldername(name))[1] = 'posts'
);

-- Allow users to update their own posts
CREATE POLICY "Users can update their own posts" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'audio-files' 
  AND (storage.foldername(name))[1] = 'posts'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow users to delete their own posts
CREATE POLICY "Users can delete their own posts" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'audio-files' 
  AND (storage.foldername(name))[1] = 'posts'
  AND (storage.foldername(name))[2] = auth.uid()::text
);