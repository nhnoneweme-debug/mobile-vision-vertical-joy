
-- POSTS
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT,
  media_url TEXT,
  media_type TEXT NOT NULL DEFAULT 'none' CHECK (media_type IN ('none','image','video')),
  thumbnail_url TEXT,
  visibility_mode TEXT NOT NULL DEFAULT 'auto' CHECK (visibility_mode IN ('auto','manual','hybrid','public')),
  visibility_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_author ON public.posts(author_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;

CREATE TABLE public.post_audience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  audience_type TEXT NOT NULL CHECK (audience_type IN ('friend','guild','class','user','exclude_user')),
  audience_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_audience_post ON public.post_audience(post_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_audience TO authenticated;
GRANT ALL ON public.post_audience TO service_role;

CREATE TABLE public.post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'ember' CHECK (kind IN ('ember','insight','strength')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id, kind)
);
CREATE INDEX idx_post_reactions_post ON public.post_reactions(post_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_reactions TO authenticated;
GRANT ALL ON public.post_reactions TO service_role;

CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_comments_post ON public.post_comments(post_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;

CREATE TABLE public.post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, viewer_id)
);
CREATE INDEX idx_post_views_post ON public.post_views(post_id);
GRANT SELECT, INSERT ON public.post_views TO authenticated;
GRANT ALL ON public.post_views TO service_role;

CREATE TABLE public.follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);
CREATE INDEX idx_follows_followed ON public.follows(followed_id);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

CREATE OR REPLACE FUNCTION public.can_view_post(_post_id UUID, _viewer UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p RECORD; is_friend BOOLEAN; shares_guild BOOLEAN; same_class BOOLEAN;
  is_targeted BOOLEAN; is_excluded BOOLEAN;
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = _post_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF p.author_id = _viewer THEN RETURN TRUE; END IF;
  SELECT EXISTS(SELECT 1 FROM public.post_audience
    WHERE post_id = _post_id AND audience_type = 'exclude_user' AND audience_id = _viewer::text) INTO is_excluded;
  IF is_excluded THEN RETURN FALSE; END IF;
  IF p.visibility_mode = 'public' THEN RETURN TRUE; END IF;
  IF p.visibility_mode IN ('manual','hybrid') THEN
    SELECT EXISTS(SELECT 1 FROM public.post_audience pa WHERE pa.post_id = _post_id AND (
      (pa.audience_type = 'user' AND pa.audience_id = _viewer::text)
      OR (pa.audience_type = 'guild' AND EXISTS(SELECT 1 FROM public.group_members gm WHERE gm.group_id::text = pa.audience_id AND gm.user_id = _viewer))
      OR (pa.audience_type = 'class' AND EXISTS(SELECT 1 FROM public.profiles pr WHERE pr.id = _viewer AND pr.behavioral_class = pa.audience_id))
      OR (pa.audience_type = 'friend' AND EXISTS(SELECT 1 FROM public.friendships f WHERE f.status = 'accepted'
            AND ((f.user_a = p.author_id AND f.user_b = _viewer) OR (f.user_b = p.author_id AND f.user_a = _viewer))))
    )) INTO is_targeted;
    IF is_targeted THEN RETURN TRUE; END IF;
    IF p.visibility_mode = 'manual' THEN RETURN FALSE; END IF;
  END IF;
  IF COALESCE((p.visibility_rule->>'friends')::boolean, true) THEN
    SELECT EXISTS(SELECT 1 FROM public.friendships f WHERE f.status = 'accepted'
      AND ((f.user_a = p.author_id AND f.user_b = _viewer) OR (f.user_b = p.author_id AND f.user_a = _viewer))) INTO is_friend;
    IF is_friend THEN RETURN TRUE; END IF;
  END IF;
  IF (p.visibility_rule->>'guild')::boolean IS TRUE THEN
    SELECT EXISTS(SELECT 1 FROM public.group_members g1
      JOIN public.group_members g2 ON g1.group_id = g2.group_id
      WHERE g1.user_id = p.author_id AND g2.user_id = _viewer) INTO shares_guild;
    IF shares_guild THEN RETURN TRUE; END IF;
  END IF;
  IF (p.visibility_rule->>'class')::boolean IS TRUE THEN
    SELECT EXISTS(SELECT 1 FROM public.profiles a JOIN public.profiles v ON v.behavioral_class = a.behavioral_class
      WHERE a.id = p.author_id AND v.id = _viewer) INTO same_class;
    IF same_class THEN RETURN TRUE; END IF;
  END IF;
  IF (p.visibility_rule->>'followers')::boolean IS TRUE THEN
    IF EXISTS(SELECT 1 FROM public.follows WHERE follower_id = _viewer AND followed_id = p.author_id) THEN RETURN TRUE; END IF;
  END IF;
  RETURN FALSE;
END $$;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select_visible" ON public.posts FOR SELECT TO authenticated USING (public.can_view_post(id, auth.uid()));
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated USING (author_id = auth.uid());

ALTER TABLE public.post_audience ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audience_manage_by_author" ON public.post_audience FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()))
  WITH CHECK (EXISTS(SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "audience_select_if_can_view" ON public.post_audience FOR SELECT TO authenticated USING (public.can_view_post(post_id, auth.uid()));

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions_select_visible" ON public.post_reactions FOR SELECT TO authenticated USING (public.can_view_post(post_id, auth.uid()));
CREATE POLICY "reactions_insert_own" ON public.post_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_view_post(post_id, auth.uid()));
CREATE POLICY "reactions_delete_own" ON public.post_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select_visible" ON public.post_comments FOR SELECT TO authenticated USING (public.can_view_post(post_id, auth.uid()));
CREATE POLICY "comments_insert_own" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_view_post(post_id, auth.uid()));
CREATE POLICY "comments_delete_own" ON public.post_comments FOR DELETE TO authenticated USING (user_id = auth.uid() OR EXISTS(SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));

ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "views_insert_self" ON public.post_views FOR INSERT TO authenticated WITH CHECK (viewer_id = auth.uid() AND public.can_view_post(post_id, auth.uid()));
CREATE POLICY "views_select_author_or_self" ON public.post_views FOR SELECT TO authenticated
  USING (viewer_id = auth.uid() OR EXISTS(SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_select_all" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "follows_insert_self" ON public.follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete_self" ON public.follows FOR DELETE TO authenticated USING (follower_id = auth.uid());

CREATE TRIGGER trg_posts_touch BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- CRYSTALS
CREATE TABLE public.power_crystals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  effect_type TEXT NOT NULL,
  effect_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.power_crystals TO authenticated;
GRANT ALL ON public.power_crystals TO service_role;
ALTER TABLE public.power_crystals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crystals_read_all" ON public.power_crystals FOR SELECT TO authenticated USING (active = true);

CREATE TABLE public.user_crystals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crystal_id UUID NOT NULL REFERENCES public.power_crystals(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('temporal','conditional','permanent')),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  condition JSONB,
  active BOOLEAN NOT NULL DEFAULT true,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_crystals_user ON public.user_crystals(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_crystals TO authenticated;
GRANT ALL ON public.user_crystals TO service_role;
ALTER TABLE public.user_crystals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_crystals_select_own" ON public.user_crystals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_crystals_modify_own" ON public.user_crystals FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_crystal_active(_user UUID, _code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uc RECORD; v_streak INT; cond_type TEXT; cond_val INT;
BEGIN
  SELECT uc2.* INTO uc FROM public.user_crystals uc2
  JOIN public.power_crystals pc ON pc.id = uc2.crystal_id
  WHERE uc2.user_id = _user AND pc.code = _code AND uc2.active = true
  ORDER BY uc2.acquired_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF uc.mode = 'permanent' THEN RETURN TRUE; END IF;
  IF uc.mode = 'temporal' THEN RETURN uc.expires_at IS NULL OR uc.expires_at > now(); END IF;
  IF uc.mode = 'conditional' THEN
    cond_type := uc.condition->>'type';
    cond_val := COALESCE((uc.condition->>'value')::INT, 0);
    IF cond_type = 'streak_min' THEN
      SELECT COALESCE(streak,0) INTO v_streak FROM public.profiles WHERE id = _user;
      RETURN v_streak >= cond_val;
    END IF;
    RETURN FALSE;
  END IF;
  RETURN FALSE;
END $$;

CREATE OR REPLACE FUNCTION public.award_habit_xp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bonus INT := NEW.xp_reward;
BEGIN
  IF NEW.status = 'completed' THEN
    IF public.is_crystal_active(NEW.user_id, 'echo_mentor') THEN
      bonus := NEW.xp_reward * 2;
    END IF;
    INSERT INTO public.xp_events (user_id, source, amount, ref_id, meta)
    VALUES (NEW.user_id, 'habit', bonus, NEW.id,
            jsonb_build_object('base', NEW.xp_reward, 'boosted', bonus <> NEW.xp_reward));
    UPDATE public.profiles SET xp = xp + bonus, updated_at = now() WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

INSERT INTO public.power_crystals (code, name, description, icon, effect_type, rarity)
VALUES
  ('oracle_eye', 'Olho do Oráculo', 'Revela os viajantes que viram seus posts em silêncio.', 'Eye', 'view_silent_viewers', 'epic'),
  ('echo_mentor', 'Eco do Mentor', 'Dobra o XP recebido por hábitos enquanto ativo.', 'Sparkles', 'xp_multiplier_habits', 'rare')
ON CONFLICT (code) DO NOTHING;

-- STUDIO
CREATE TABLE public.studio_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('crystal','brasas','xp','inventory_item','badge')),
  name TEXT NOT NULL,
  description TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_rewards TO authenticated;
GRANT ALL ON public.studio_rewards TO service_role;
ALTER TABLE public.studio_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rewards_read_all" ON public.studio_rewards FOR SELECT TO authenticated USING (true);
CREATE POLICY "rewards_admin_write" ON public.studio_rewards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'studio_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'studio_admin'));

CREATE TABLE public.studio_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  rules JSONB NOT NULL DEFAULT '{"perspectives":[]}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_challenges TO authenticated;
GRANT ALL ON public.studio_challenges TO service_role;
ALTER TABLE public.studio_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges_read_published" ON public.studio_challenges FOR SELECT TO authenticated
  USING (status = 'published' OR public.has_role(auth.uid(), 'studio_admin'));
CREATE POLICY "challenges_admin_write" ON public.studio_challenges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'studio_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'studio_admin'));

CREATE TABLE public.studio_challenge_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.studio_challenges(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.studio_rewards(id) ON DELETE CASCADE,
  tier INT NOT NULL DEFAULT 1,
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scr_challenge ON public.studio_challenge_rewards(challenge_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_challenge_rewards TO authenticated;
GRANT ALL ON public.studio_challenge_rewards TO service_role;
ALTER TABLE public.studio_challenge_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scr_read_published" ON public.studio_challenge_rewards FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.studio_challenges c WHERE c.id = challenge_id
    AND (c.status = 'published' OR public.has_role(auth.uid(), 'studio_admin'))));
CREATE POLICY "scr_admin_write" ON public.studio_challenge_rewards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'studio_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'studio_admin'));

CREATE TABLE public.studio_challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.studio_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  awarded_rewards UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  completed_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_challenge_participants TO authenticated;
GRANT ALL ON public.studio_challenge_participants TO service_role;
ALTER TABLE public.studio_challenge_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scp_select_own_or_admin" ON public.studio_challenge_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'studio_admin'));
CREATE POLICY "scp_insert_own" ON public.studio_challenge_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "scp_update_own_or_admin" ON public.studio_challenge_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'studio_admin'));

CREATE TRIGGER trg_rewards_touch BEFORE UPDATE ON public.studio_rewards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_challenges_touch BEFORE UPDATE ON public.studio_challenges FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_scp_touch BEFORE UPDATE ON public.studio_challenge_participants FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.evaluate_challenge(_user UUID, _challenge UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c RECORD; persp JSONB; result JSONB := '[]'::jsonb;
  metric TEXT; target NUMERIC; actual NUMERIC; pname TEXT;
BEGIN
  SELECT * INTO c FROM public.studio_challenges WHERE id = _challenge;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
  FOR persp IN SELECT * FROM jsonb_array_elements(COALESCE(c.rules->'perspectives','[]'::jsonb))
  LOOP
    metric := persp->>'metric';
    target := COALESCE((persp->>'target')::NUMERIC, 1);
    pname := persp->>'name';
    actual := 0;
    IF metric = 'habit_completion' THEN
      SELECT COUNT(*) INTO actual FROM public.habit_logs hl JOIN public.habits h ON h.id = hl.habit_id
      WHERE h.user_id = _user
        AND (c.start_at IS NULL OR hl.log_date >= c.start_at::date)
        AND (c.end_at IS NULL OR hl.log_date <= c.end_at::date);
    ELSIF metric = 'streak_min' THEN
      SELECT COALESCE(streak,0) INTO actual FROM public.profiles WHERE id = _user;
    ELSIF metric = 'xp_total' THEN
      SELECT COALESCE(SUM(amount),0) INTO actual FROM public.xp_events WHERE user_id = _user
        AND (c.start_at IS NULL OR created_at >= c.start_at)
        AND (c.end_at IS NULL OR created_at <= c.end_at);
    ELSIF metric = 'posts_count' THEN
      SELECT COUNT(*) INTO actual FROM public.posts WHERE author_id = _user
        AND (c.start_at IS NULL OR created_at >= c.start_at)
        AND (c.end_at IS NULL OR created_at <= c.end_at);
    ELSIF metric = 'rituals_count' THEN
      SELECT COUNT(*) INTO actual FROM public.ritual_logs WHERE user_id = _user
        AND (c.start_at IS NULL OR created_at >= c.start_at)
        AND (c.end_at IS NULL OR created_at <= c.end_at);
    END IF;
    result := result || jsonb_build_object(
      'name', pname, 'metric', metric, 'target', target, 'actual', actual,
      'pct', LEAST(1.0, actual / NULLIF(target,0))
    );
  END LOOP;
  RETURN result;
END $$;
