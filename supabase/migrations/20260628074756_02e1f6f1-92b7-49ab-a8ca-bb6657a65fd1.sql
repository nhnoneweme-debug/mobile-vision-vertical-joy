-- Roles
CREATE TYPE public.app_role AS ENUM ('player', 'orientador', 'admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Orientador invite codes (admin-curated; redeemed by user to gain role)
CREATE TABLE public.orientador_invites (
  code TEXT PRIMARY KEY,
  note TEXT,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.orientador_invites TO authenticated;
GRANT ALL ON public.orientador_invites TO service_role;
ALTER TABLE public.orientador_invites ENABLE ROW LEVEL SECURITY;
-- No direct policies: only via RPC below.

-- Seed a few invite codes so the feature is usable out of the box
INSERT INTO public.orientador_invites (code, note) VALUES
  ('ORI-FOUNDER', 'founder seat'),
  ('ORI-ALPHA-01', 'alpha mentor'),
  ('ORI-ALPHA-02', 'alpha mentor'),
  ('ORI-ALPHA-03', 'alpha mentor')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.redeem_orientador_invite(_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  UPDATE public.orientador_invites
     SET used_by = v_user, used_at = now()
   WHERE code = _code AND used_by IS NULL;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'orientador')
    ON CONFLICT DO NOTHING;
  RETURN TRUE;
END $$;
REVOKE EXECUTE ON FUNCTION public.redeem_orientador_invite(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_orientador_invite(TEXT) TO authenticated;

-- Orientador <-> Student link
CREATE TABLE public.orientador_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orientador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','ended')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (orientador_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orientador_students TO authenticated;
GRANT ALL ON public.orientador_students TO service_role;
ALTER TABLE public.orientador_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orientador manages own links" ON public.orientador_students
  FOR ALL TO authenticated
  USING (orientador_id = auth.uid() AND public.has_role(auth.uid(), 'orientador'))
  WITH CHECK (orientador_id = auth.uid() AND public.has_role(auth.uid(), 'orientador'));

CREATE POLICY "student sees own links" ON public.orientador_students
  FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "student updates own link status" ON public.orientador_students
  FOR UPDATE TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- Orientador missions sent to students
CREATE TABLE public.orientador_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orientador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT,
  area_slug TEXT,
  xp_reward INT NOT NULL DEFAULT 50,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orientador_missions TO authenticated;
GRANT ALL ON public.orientador_missions TO service_role;
ALTER TABLE public.orientador_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orientador manages own missions" ON public.orientador_missions
  FOR ALL TO authenticated
  USING (orientador_id = auth.uid() AND public.has_role(auth.uid(), 'orientador'))
  WITH CHECK (orientador_id = auth.uid() AND public.has_role(auth.uid(), 'orientador'));

CREATE POLICY "student reads own missions" ON public.orientador_missions
  FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "student completes own mission" ON public.orientador_missions
  FOR UPDATE TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- Award XP when a mission is marked completed
CREATE OR REPLACE FUNCTION public.award_orientador_mission_xp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.completed_at := now();
    INSERT INTO public.xp_events (user_id, amount, source, ref_id, meta)
    VALUES (NEW.student_id, NEW.xp_reward, 'orientador_mission', NEW.id,
            jsonb_build_object('orientador_id', NEW.orientador_id));
    UPDATE public.profiles SET xp = xp + NEW.xp_reward, updated_at = now()
     WHERE id = NEW.student_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_orientador_mission_complete
  BEFORE UPDATE ON public.orientador_missions
  FOR EACH ROW EXECUTE FUNCTION public.award_orientador_mission_xp();

-- Allow orientadores to read student snapshot data needed for the panel.
-- Profiles: read minimal fields for linked active students.
CREATE POLICY "orientador reads linked student profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'orientador')
    AND EXISTS (
      SELECT 1 FROM public.orientador_students os
      WHERE os.orientador_id = auth.uid()
        AND os.student_id = profiles.id
        AND os.status = 'active'
    )
  );

CREATE POLICY "orientador reads linked student quests" ON public.daily_quests
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'orientador')
    AND EXISTS (
      SELECT 1 FROM public.orientador_students os
      WHERE os.orientador_id = auth.uid()
        AND os.student_id = daily_quests.user_id
        AND os.status = 'active'
    )
  );
