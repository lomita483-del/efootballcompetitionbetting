DROP POLICY IF EXISTS "Users manage own files in public buckets" ON storage.objects;
CREATE POLICY "Users manage own files in public buckets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = ANY (ARRAY['avatars','chat-images','team-logos','player-avatars','announcements','highlights','ads'])
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = ANY (ARRAY['avatars','chat-images','team-logos','player-avatars','announcements','highlights','ads'])
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete own gang emblem" ON storage.objects;
CREATE POLICY "Users delete own gang emblem"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'gang-emblems' AND (auth.uid())::text = (storage.foldername(name))[1]);