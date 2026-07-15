
DROP POLICY IF EXISTS "Update friendships I'm part of" ON public.friendships;

CREATE POLICY "Addressee resolves pending requests"
  ON public.friendships FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (requester_id, addressee_id)
  )
  WITH CHECK (
    auth.uid() IN (requester_id, addressee_id)
    AND (
      (auth.uid() = addressee_id AND status IN ('accepted', 'declined', 'blocked'))
      OR (status = 'blocked')
      OR (status = (SELECT f2.status FROM public.friendships f2 WHERE f2.id = friendships.id))
    )
  );

DROP POLICY IF EXISTS "social_media_read_auth" ON storage.objects;

CREATE POLICY "social_media_read_scoped"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'social-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.media_url = storage.objects.name
          AND public.can_view_post(p.id, auth.uid())
      )
    )
  );
