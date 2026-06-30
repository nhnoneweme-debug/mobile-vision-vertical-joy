
-- shared updated_at helper (created if missing)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- REPORTS
CREATE TABLE public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post','comment','user','message')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed','actioned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_insert_self" ON public.content_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "report_select_own" ON public.content_reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE INDEX idx_content_reports_target ON public.content_reports(target_type, target_id);
CREATE INDEX idx_content_reports_status ON public.content_reports(status);
CREATE TRIGGER trg_content_reports_updated
BEFORE UPDATE ON public.content_reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BLOCKS
CREATE TABLE public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "block_select_own" ON public.user_blocks
  FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "block_insert_self" ON public.user_blocks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "block_delete_own" ON public.user_blocks
  FOR DELETE TO authenticated USING (auth.uid() = blocker_id);
CREATE INDEX idx_user_blocks_blocker ON public.user_blocks(blocker_id);
CREATE INDEX idx_user_blocks_blocked ON public.user_blocks(blocked_id);

CREATE OR REPLACE FUNCTION public.is_blocked(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = _a AND blocked_id = _b)
       OR (blocker_id = _b AND blocked_id = _a)
  )
$$;
REVOKE ALL ON FUNCTION public.is_blocked(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) TO authenticated, service_role;
