-- Create policy to allow users to upload audio files to collaboration project folders
CREATE POLICY "Users can upload to collaboration project folders" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'audio-files' 
  AND EXISTS (
    SELECT 1 
    FROM public.collaboration_members cm
    WHERE cm.collaboration_id::text = (storage.foldername(name))[1]
    AND cm.user_id = auth.uid()
    AND cm.status = 'accepted'
  )
);

-- Create policy to allow users to read audio files from collaboration project folders
CREATE POLICY "Users can read collaboration project audio files" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'audio-files' 
  AND EXISTS (
    SELECT 1 
    FROM public.collaboration_members cm
    WHERE cm.collaboration_id::text = (storage.foldername(name))[1]
    AND cm.user_id = auth.uid()
    AND cm.status = 'accepted'
  )
);

-- Create policy to allow users to update audio files in collaboration project folders
CREATE POLICY "Users can update collaboration project audio files" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'audio-files' 
  AND EXISTS (
    SELECT 1 
    FROM public.collaboration_members cm
    WHERE cm.collaboration_id::text = (storage.foldername(name))[1]
    AND cm.user_id = auth.uid()
    AND cm.status = 'accepted'
  )
);

-- Create policy to allow users to delete audio files from collaboration project folders
CREATE POLICY "Users can delete collaboration project audio files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'audio-files' 
  AND EXISTS (
    SELECT 1 
    FROM public.collaboration_members cm
    WHERE cm.collaboration_id::text = (storage.foldername(name))[1]
    AND cm.user_id = auth.uid()
    AND cm.status = 'accepted'
  )
);