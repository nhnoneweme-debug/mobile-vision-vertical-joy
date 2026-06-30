CREATE TABLE IF NOT EXISTS public.post_events (
  post_id uuid PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  location_text text,
  capacity int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_events TO authenticated;
GRANT ALL ON public.post_events TO service_role;

ALTER TABLE public.post_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_select_visible ON public.post_events FOR SELECT
  USING (public.can_view_post(post_id, auth.uid()));

CREATE POLICY event_manage_by_author ON public.post_events FOR ALL
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_events.post_id AND p.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_events.post_id AND p.author_id = auth.uid()));

CREATE TRIGGER trg_post_events_updated_at BEFORE UPDATE ON public.post_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.post_event_rsvps (
  post_id uuid NOT NULL REFERENCES public.post_events(post_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('going','maybe','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_event_rsvps TO authenticated;
GRANT ALL ON public.post_event_rsvps TO service_role;

ALTER TABLE public.post_event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY rsvp_select_visible ON public.post_event_rsvps FOR SELECT
  USING (public.can_view_post(post_id, auth.uid()));

CREATE POLICY rsvp_insert_own ON public.post_event_rsvps FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.can_view_post(post_id, auth.uid()));

CREATE POLICY rsvp_update_own ON public.post_event_rsvps FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY rsvp_delete_own ON public.post_event_rsvps FOR DELETE
  USING (user_id = auth.uid());

CREATE TRIGGER trg_rsvp_updated_at BEFORE UPDATE ON public.post_event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_post_events_starts_at ON public.post_events(starts_at);
CREATE INDEX IF NOT EXISTS idx_post_event_rsvps_user ON public.post_event_rsvps(user_id);