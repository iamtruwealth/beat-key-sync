-- Create policies for artwork storage bucket to allow profile image uploads
CREATE POLICY "Users can upload their own profile images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'artwork' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own profile images" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'artwork' AND 
  (auth.uid()::text = (storage.foldername(name))[1] OR auth.uid() IS NULL)
);

CREATE POLICY "Users can update their own profile images" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'artwork' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'artwork' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);