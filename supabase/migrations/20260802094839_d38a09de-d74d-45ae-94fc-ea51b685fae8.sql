CREATE POLICY "exec media: owner reads own folder"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'execution-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "exec media: owner uploads to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'execution-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "exec media: owner updates own folder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'execution-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'execution-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "exec media: owner deletes own folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'execution-media' AND (storage.foldername(name))[1] = auth.uid()::text);