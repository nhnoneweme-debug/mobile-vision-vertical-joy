import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type ChallengeMetric = "checkins" | "treinos" | "minutos";

export type Challenge = {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  description: string | null;
  metric: ChallengeMetric;
  target: number;
  starts_at: string;
  ends_at: string;
  winner_user_id: string | null;
  finalized_at: string | null;
  created_at: string;
  group_name?: string;
};

export type ChallengeStatus = "upcoming" | "active" | "ended";

export type ChallengeCheckin = {
  id: string;
  challenge_id: string;
  user_id: string;
  checkin_date: string;
  workout_session_id: string | null;
  note: string | null;
  photo_url: string | null;
  points: number;
  created_at: string;
};

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  value: number;
  rank: number;
};

export type CalendarRow = {
  user_id: string;
  display_name: string;
  checkin_date: string;
};

function isoDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export function statusOf(c: Challenge, now = new Date()): ChallengeStatus {
  const s = new Date(c.starts_at).getTime();
  const e = new Date(c.ends_at).getTime();
  const t = now.getTime();
  if (t < s) return "upcoming";
  if (t > e) return "ended";
  return "active";
}

/** Lista todos os desafios dos grupos do usuário. */
export async function listMyChallenges(): Promise<Challenge[]> {
  const uid = await myId();
  if (!uid) return [];
  const { data: gm, error: gmErr } = await db
    .from("group_members")
    .select("group_id")
    .eq("user_id", uid);
  if (gmErr) throw gmErr;
  const gids = (gm ?? []).map((r: { group_id: string }) => r.group_id);
  if (gids.length === 0) return [];
  const { data, error } = await db
    .from("challenges")
    .select(
      "id,group_id,created_by,title,description,metric,target,starts_at,ends_at,winner_user_id,finalized_at,created_at,groups(name)",
    )
    .in("group_id", gids)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({ ...r, group_name: r.groups?.name })) as Challenge[];
}

export async function listGroupChallenges(groupId: string): Promise<Challenge[]> {
  const { data, error } = await db
    .from("challenges")
    .select(
      "id,group_id,created_by,title,description,metric,target,starts_at,ends_at,winner_user_id,finalized_at,created_at",
    )
    .eq("group_id", groupId)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Challenge[];
}

export async function getChallenge(id: string): Promise<Challenge | null> {
  const { data, error } = await db
    .from("challenges")
    .select(
      "id,group_id,created_by,title,description,metric,target,starts_at,ends_at,winner_user_id,finalized_at,created_at,groups(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ...(data as any), group_name: (data as any).groups?.name };
}

export async function createChallenge(input: {
  group_id: string;
  title: string;
  description?: string;
  metric: ChallengeMetric;
  target: number;
  starts_at: string; // ISO
  ends_at: string; // ISO
}): Promise<Challenge> {
  const uid = await myId();
  if (!uid) throw new Error("Faça login.");
  const { data, error } = await db
    .from("challenges")
    .insert({
      group_id: input.group_id,
      created_by: uid,
      title: input.title.trim().slice(0, 80),
      description: input.description?.trim() || null,
      metric: input.metric,
      target: input.target,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
    })
    .select(
      "id,group_id,created_by,title,description,metric,target,starts_at,ends_at,winner_user_id,finalized_at,created_at",
    )
    .single();
  if (error) throw error;
  return data as Challenge;
}

/** Retorna check-ins do usuário atual em um desafio. */
export async function myCheckins(challengeId: string): Promise<ChallengeCheckin[]> {
  const uid = await myId();
  if (!uid) return [];
  const { data, error } = await db
    .from("challenge_checkins")
    .select(
      "id,challenge_id,user_id,checkin_date,workout_session_id,note,photo_url,points,created_at",
    )
    .eq("challenge_id", challengeId)
    .eq("user_id", uid)
    .order("checkin_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ChallengeCheckin[];
}

export async function didCheckinToday(challengeId: string): Promise<boolean> {
  const uid = await myId();
  if (!uid) return false;
  const { data, error } = await db
    .from("challenge_checkins")
    .select("id")
    .eq("challenge_id", challengeId)
    .eq("user_id", uid)
    .eq("checkin_date", isoDate())
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

/** Desafios ativos dos grupos do usuário SEM check-in hoje. */
export async function getEligibleChallengesForToday(): Promise<Challenge[]> {
  const uid = await myId();
  if (!uid) return [];
  const all = await listMyChallenges();
  const active = all.filter((c) => statusOf(c) === "active");
  if (active.length === 0) return [];
  const ids = active.map((c) => c.id);
  const { data: logs } = await db
    .from("challenge_checkins")
    .select("challenge_id")
    .eq("user_id", uid)
    .eq("checkin_date", isoDate())
    .in("challenge_id", ids);
  const done = new Set((logs ?? []).map((r: { challenge_id: string }) => r.challenge_id));
  return active.filter((c) => !done.has(c.id));
}

/** Upload de foto no bucket privado; retorna signed URL de 30 dias. */
async function uploadPhoto(challengeId: string, file: File): Promise<string | null> {
  const uid = await myId();
  if (!uid) return null;
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
  const path = `${challengeId}/${uid}/${Date.now()}.${ext}`;
  const up = await supabase.storage.from("challenge-photos").upload(path, file, {
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (up.error) throw new Error(up.error.message);
  const signed = await supabase.storage
    .from("challenge-photos")
    .createSignedUrl(path, 60 * 60 * 24 * 30);
  return signed.data?.signedUrl ?? null;
}

export async function checkinToChallenge(input: {
  challengeId: string;
  workoutSessionId?: string | null;
  note?: string;
  photoFile?: File | null;
}): Promise<ChallengeCheckin> {
  const uid = await myId();
  if (!uid) throw new Error("Faça login.");
  let photo_url: string | null = null;
  if (input.photoFile) {
    photo_url = await uploadPhoto(input.challengeId, input.photoFile);
  }
  const { data, error } = await db
    .from("challenge_checkins")
    .insert({
      challenge_id: input.challengeId,
      user_id: uid,
      checkin_date: isoDate(),
      workout_session_id: input.workoutSessionId ?? null,
      note: input.note?.trim() || null,
      photo_url,
    })
    .select(
      "id,challenge_id,user_id,checkin_date,workout_session_id,note,photo_url,points,created_at",
    )
    .single();
  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("duplicate")) throw new Error("Você já fez check-in hoje.");
    if (msg.includes("checkin_outside_window")) throw new Error("Fora do período do desafio.");
    throw new Error(msg || "Não consegui registrar o check-in.");
  }
  return data as ChallengeCheckin;
}

export async function deleteCheckin(id: string): Promise<void> {
  const { error } = await db.from("challenge_checkins").delete().eq("id", id);
  if (error) throw error;
}

export async function leaderboard(challengeId: string): Promise<LeaderboardRow[]> {
  const { data, error } = await db.rpc("challenge_leaderboard", { _challenge: challengeId });
  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}

export async function calendarFor(challengeId: string, month = new Date()): Promise<CalendarRow[]> {
  const monthISO = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;
  const { data, error } = await db.rpc("challenge_calendar", {
    _challenge: challengeId,
    _month: monthISO,
  });
  if (error) throw error;
  return (data ?? []) as CalendarRow[];
}

export async function finalizeIfEnded(challengeId: string): Promise<void> {
  await db.rpc("finalize_challenge", { _challenge: challengeId });
}

/** Última sessão de treino do dia (para vincular ao check-in). */
export async function todayWorkoutSessionId(): Promise<string | null> {
  const uid = await myId();
  if (!uid) return null;
  const { data } = await db
    .from("workout_sessions")
    .select("id")
    .eq("user_id", uid)
    .eq("session_date", isoDate())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
