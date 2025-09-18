-- Make the audio-files bucket public so getPublicUrl works
update storage.buckets set public = true where id = 'audio-files';

-- Create storage RLS policies for uploads scoped to the user's folder and public reads
DO $$ BEGIN
  -- Public read access for audio-files bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read for audio-files'
  ) THEN
    CREATE POLICY "Public read for audio-files"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'audio-files');
  END IF;

  -- Allow authenticated users to upload into their own folder (/<user_id>/...)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload to their own folder in audio-files'
  ) THEN
    CREATE POLICY "Users can upload to their own folder in audio-files"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  -- Allow owners to update their own files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own files in audio-files'
  ) THEN
    CREATE POLICY "Users can update their own files in audio-files"
    ON storage.objects
    FOR UPDATE
    USING (
      bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  -- Allow owners to delete their own files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own files in audio-files'
  ) THEN
    CREATE POLICY "Users can delete their own files in audio-files"
    ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;