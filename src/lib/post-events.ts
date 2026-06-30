import { supabase } from "@/integrations/supabase/client";

export type RsvpStatus = "going" | "maybe" | "declined";

export type PostEvent = {
  post_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location_text: string | null;
  capacity: number | null;
};

export type EventCounts = {
  going: number;
  maybe: number;
  declined: number;
  my_status: RsvpStatus | null;
};

export async function attachEventToPost(input: {
  postId: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  locationText?: string | null;
  capacity?: number | null;
}) {
  const { error } = await supabase.from("post_events").insert({
    post_id: input.postId,
    title: input.title.trim(),
    starts_at: input.startsAt,
    ends_at: input.endsAt ?? null,
    location_text: input.locationText?.trim() || null,
    capacity: input.capacity ?? null,
  });
  if (error) throw error;
}

export async function getEventsForPosts(postIds: string[]): Promise<Map<string, PostEvent>> {
  if (postIds.length === 0) return new Map();
  const { data } = await supabase
    .from("post_events")
    .select("post_id, title, starts_at, ends_at, location_text, capacity")
    .in("post_id", postIds);
  return new Map((data ?? []).map((e) => [e.post_id, e as PostEvent]));
}

export async function getRsvpCounts(postId: string): Promise<EventCounts> {
  const { data: u } = await supabase.auth.getUser();
  const me = u.user?.id;
  const { data } = await supabase
    .from("post_event_rsvps")
    .select("user_id, status")
    .eq("post_id", postId);
  const rows = data ?? [];
  return {
    going: rows.filter((r) => r.status === "going").length,
    maybe: rows.filter((r) => r.status === "maybe").length,
    declined: rows.filter((r) => r.status === "declined").length,
    my_status:
      (me && (rows.find((r) => r.user_id === me)?.status as RsvpStatus)) || null,
  };
}

export async function setRsvp(postId: string, status: RsvpStatus) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado.");
  const { error } = await supabase
    .from("post_event_rsvps")
    .upsert(
      { post_id: postId, user_id: u.user.id, status },
      { onConflict: "post_id,user_id" },
    );
  if (error) throw error;
}

export async function clearRsvp(postId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase
    .from("post_event_rsvps")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", u.user.id);
}
