-- Círculo (grupos "gym rats"): feed do grupo + ranking semanal.
-- Reaproveita groups / group_members / is_group_member / join_group_by_invite já existentes.

-- ============================================================
-- Feed do grupo (posts). author_name é denormalizado porque profiles.SELECT é
-- own-row (não dá pra ler o nome de outros membros pela tabela profiles).
-- ============================================================
CREATE TABLE public.group_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Viajante',
  content TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'post', -- 'post' | 'treino'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.group_posts TO authenticated;
GRANT ALL ON public.group_posts TO service_role;
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read group_posts" ON public.group_posts FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "member posts to group" ON public.group_posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "author deletes own post" ON public.group_posts FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE INDEX group_posts_idx ON public.group_posts (group_id, created_at DESC);

-- ============================================================
-- Ranking semanal: dias treinados (sessões) por membro na semana atual.
-- SECURITY DEFINER pra agregar sessões de todos os membros; só responde se o
-- caller for membro do grupo (não vaza dados de grupos alheios).
-- ============================================================
CREATE OR REPLACE FUNCTION public.group_weekly_ranking(_group_id UUID)
RETURNS TABLE (user_id UUID, display_name TEXT, sessions BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_group_member(_group_id, auth.uid()) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT gm.user_id, p.display_name, COUNT(ws.id) AS sessions
    FROM public.group_members gm
    JOIN public.profiles p ON p.id = gm.user_id
    LEFT JOIN public.workout_sessions ws
      ON ws.user_id = gm.user_id
      AND ws.session_date >= date_trunc('week', now())::date
    WHERE gm.group_id = _group_id
    GROUP BY gm.user_id, p.display_name
    ORDER BY sessions DESC, p.display_name ASC;
END $$;
REVOKE EXECUTE ON FUNCTION public.group_weekly_ranking(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_weekly_ranking(UUID) TO authenticated;
