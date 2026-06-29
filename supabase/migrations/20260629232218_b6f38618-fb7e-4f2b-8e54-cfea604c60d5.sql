
CREATE POLICY "social_media_read_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'social-media');
CREATE POLICY "social_media_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "social_media_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "social_media_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);
