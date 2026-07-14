
CREATE POLICY "challenge-photos read by group members"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'challenge-photos'
    AND EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id::text = split_part(name, '/', 1)
        AND public.is_group_member(c.group_id, auth.uid())
    )
  );

CREATE POLICY "challenge-photos owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'challenge-photos'
    AND auth.uid()::text = split_part(name, '/', 2)
  );

CREATE POLICY "challenge-photos owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'challenge-photos'
    AND auth.uid()::text = split_part(name, '/', 2)
  );
