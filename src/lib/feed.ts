import { supabase } from "@/integrations/supabase/client";
import { getEventsForPosts, type PostEvent } from "@/lib/post-events";

export type MediaType = "none" | "image" | "video";
export type VisibilityMode = "auto" | "manual" | "hybrid" | "public";

export type VisibilityRule = {
  friends?: boolean;
  guild?: boolean;
  class?: boolean;
  followers?: boolean;
};

export type FeedPost = {
  id: string;
  author_id: string;
  body: string | null;
  media_url: string | null;
  media_type: MediaType;
  thumbnail_url: string | null;
  visibility_mode: VisibilityMode;
  created_at: string;
  author?: { display_name: string | null };
  reactions_count?: number;
  comments_count?: number;
  views_count?: number;
  my_reaction?: string | null;
  signed_media_url?: string | null;
  event?: PostEvent | null;
};

export async function uploadPostMedia(
  userId: string,
  file: File,
): Promise<{ path: string; type: MediaType }> {
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) throw new Error("Apenas imagem ou vídeo.");
  if (isVideo && file.size > 20 * 1024 * 1024)
    throw new Error("Vídeo precisa ter até 20MB.");
  if (isImage && file.size > 10 * 1024 * 1024)
    throw new Error("Imagem precisa ter até 10MB.");
  const ext = file.name.split(".").pop() ?? (isVideo ? "mp4" : "jpg");
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("social-media")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return { path, type: isVideo ? "video" : "image" };
}

export async function getSignedMediaUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("social-media")
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export type CreatePostInput = {
  body: string;
  mediaPath?: string | null;
  mediaType?: MediaType;
  visibilityMode: VisibilityMode;
  visibilityRule: VisibilityRule;
  audience?: { type: "user" | "guild" | "class" | "friend" | "exclude_user"; id: string }[];
};

export async function createPost(input: CreatePostInput): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado.");
  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: u.user.id,
      body: input.body.trim() || null,
      media_url: input.mediaPath ?? null,
      media_type: input.mediaType ?? "none",
      visibility_mode: input.visibilityMode,
      visibility_rule: input.visibilityRule as never,
    })
    .select("id")
    .single();
  if (error) throw error;
  if (input.audience && input.audience.length > 0) {
    await supabase.from("post_audience").insert(
      input.audience.map((a) => ({
        post_id: data.id,
        audience_type: a.type,
        audience_id: a.id,
      })),
    );
  }
  return data.id;
}

export async function listFeed(limit = 20): Promise<FeedPost[]> {
  const { data: u } = await supabase.auth.getUser();
  const me = u.user?.id;
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, author_id, body, media_url, media_type, thumbnail_url, visibility_mode, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!posts || posts.length === 0) return [];

  const ids = posts.map((p) => p.id);
  const authorIds = Array.from(new Set(posts.map((p) => p.author_id)));

  const [profilesQ, reactionsQ, commentsQ, viewsQ, myReactQ, eventsMap] = await Promise.all([
    supabase.from("public_profiles").select("id, display_name").in("id", authorIds),
    supabase.from("post_reactions").select("post_id").in("post_id", ids),
    supabase.from("post_comments").select("post_id").in("post_id", ids),
    supabase.from("post_views").select("post_id").in("post_id", ids),
    me
      ? supabase.from("post_reactions").select("post_id, kind").in("post_id", ids).eq("user_id", me)
      : Promise.resolve({ data: [] as { post_id: string; kind: string }[] }),
    getEventsForPosts(ids),
  ]);
  const profilesMap = new Map(
    (profilesQ.data ?? []).map((p) => [p.id, { display_name: p.display_name }]),
  );
  const count = (rows: { post_id: string }[] | null | undefined, id: string) =>
    (rows ?? []).filter((r) => r.post_id === id).length;
  const myReactMap = new Map(((myReactQ as { data?: { post_id: string; kind: string }[] }).data ?? []).map((r) => [r.post_id, r.kind]));

  const enriched: FeedPost[] = await Promise.all(
    posts.map(async (p) => {
      const signed =
        p.media_url && p.media_type !== "none" ? await getSignedMediaUrl(p.media_url) : null;
      return {
        ...p,
        media_type: p.media_type as MediaType,
        visibility_mode: p.visibility_mode as VisibilityMode,
        author: profilesMap.get(p.author_id) ?? undefined,
        reactions_count: count(reactionsQ.data, p.id),
        comments_count: count(commentsQ.data, p.id),
        views_count: count(viewsQ.data, p.id),
        my_reaction: myReactMap.get(p.id) ?? null,
        signed_media_url: signed,
        event: eventsMap.get(p.id) ?? null,
      };
    }),
  );
  return enriched;
}

export async function reactToPost(postId: string, kind: "ember" | "insight" | "strength") {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado.");
  const existing = await supabase
    .from("post_reactions")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", u.user.id)
    .eq("kind", kind)
    .maybeSingle();
  if (existing.data) {
    await supabase.from("post_reactions").delete().eq("id", existing.data.id);
    return false;
  }
  const { error } = await supabase
    .from("post_reactions")
    .insert({ post_id: postId, user_id: u.user.id, kind });
  if (error) throw error;
  return true;
}

export async function commentOnPost(postId: string, body: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado.");
  const { error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, user_id: u.user.id, body: body.trim() });
  if (error) throw error;
}

export async function listComments(postId: string) {
  const { data, error } = await supabase
    .from("post_comments")
    .select("id, user_id, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) return [];
  const ids = Array.from(new Set(data.map((c) => c.user_id)));
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids);
  const map = new Map((profs ?? []).map((p) => [p.id, p]));
  return data.map((c) => ({ ...c, author: map.get(c.user_id) ?? null }));
}

export async function registerView(postId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase
    .from("post_views")
    .insert({ post_id: postId, viewer_id: u.user.id })
    .select()
    .maybeSingle();
}

export async function listSilentViewers(postId: string) {
  const { data: views } = await supabase
    .from("post_views")
    .select("viewer_id, viewed_at")
    .eq("post_id", postId);
  const { data: reactions } = await supabase
    .from("post_reactions")
    .select("user_id")
    .eq("post_id", postId);
  const { data: comments } = await supabase
    .from("post_comments")
    .select("user_id")
    .eq("post_id", postId);
  const reacted = new Set([
    ...(reactions ?? []).map((r) => r.user_id),
    ...(comments ?? []).map((c) => c.user_id),
  ]);
  const silent = (views ?? []).filter((v) => !reacted.has(v.viewer_id));
  if (silent.length === 0) return [];
  const ids = silent.map((v) => v.viewer_id);
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids);
  const map = new Map((profs ?? []).map((p) => [p.id, p]));
  return silent.map((v) => ({ ...v, profile: map.get(v.viewer_id) ?? null }));
}
