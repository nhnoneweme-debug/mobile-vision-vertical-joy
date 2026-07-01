import { supabase } from "@/integrations/supabase/client";

export type OrientadorStudentLink = {
  id: string;
  orientador_id: string;
  student_id: string;
  status: "pending" | "active" | "ended";
  invited_at: string;
  accepted_at: string | null;
};

export type StudentSnapshot = {
  link: OrientadorStudentLink;
  display_name: string | null;
  behavioral_class: string | null;
  xp: number;
  streak: number;
  last_quest_at: string | null;
  inactive_days: number | null;
  friend_code: string | null;
};

export type OrientadorMission = {
  id: string;
  orientador_id: string;
  student_id: string;
  title: string;
  detail: string | null;
  area_slug: string | null;
  xp_reward: number;
  due_at: string | null;
  status: "pending" | "completed" | "cancelled";
  created_at: string;
  completed_at: string | null;
};

export async function isOrientador(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "orientador")
    .maybeSingle();
  return !!data;
}

export async function redeemOrientadorCode(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("redeem_orientador_invite", {
    _code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  return !!data;
}

export async function inviteStudentByFriendCode(
  orientadorId: string,
  friendCode: string,
): Promise<void> {
  const code = friendCode.trim().toUpperCase();
  const { data: prof, error: e1 } = await supabase
    .from("profiles")
    .select("id")
    .eq("friend_code", code)
    .maybeSingle();
  if (e1) throw e1;
  if (!prof) throw new Error("Aluno não encontrado com esse código.");
  if (prof.id === orientadorId) throw new Error("Você não pode vincular a si mesmo.");
  const { error } = await supabase.from("orientador_students").insert({
    orientador_id: orientadorId,
    student_id: prof.id,
    status: "pending",
  });
  if (error) throw error;
}

export async function respondToInvite(
  linkId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("orientador_students")
    .update({
      status: accept ? "active" : "ended",
      accepted_at: accept ? new Date().toISOString() : null,
    })
    .eq("id", linkId);
  if (error) throw error;
}

export async function listMyOrientadorInvites(studentId: string) {
  const { data, error } = await supabase
    .from("orientador_students")
    .select("*")
    .eq("student_id", studentId)
    .order("invited_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrientadorStudentLink[];
}

export async function listStudents(orientadorId: string): Promise<StudentSnapshot[]> {
  const { data: links, error } = await supabase
    .from("orientador_students")
    .select("*")
    .eq("orientador_id", orientadorId)
    .order("invited_at", { ascending: false });
  if (error) throw error;
  const rows = (links ?? []) as OrientadorStudentLink[];
  if (rows.length === 0) return [];

  const studentIds = rows.map((r) => r.student_id);
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name, behavioral_class, xp, streak, friend_code")
    .in("id", studentIds);

  const { data: quests } = await supabase
    .from("daily_quests")
    .select("user_id, quest_date, completed_at")
    .in("user_id", studentIds)
    .eq("status", "completed")
    .order("quest_date", { ascending: false });

  const lastByUser = new Map<string, string>();
  for (const q of (quests ?? []) as Array<{
    user_id: string;
    quest_date: string;
    completed_at: string | null;
  }>) {
    if (!lastByUser.has(q.user_id)) {
      lastByUser.set(q.user_id, q.completed_at ?? q.quest_date);
    }
  }
  const now = Date.now();
  return rows.map((link) => {
    const p = (profs ?? []).find((x) => x.id === link.student_id);
    const lastAt = lastByUser.get(link.student_id) ?? null;
    const inactive = lastAt
      ? Math.floor((now - new Date(lastAt).getTime()) / 86_400_000)
      : null;
    return {
      link,
      display_name: p?.display_name ?? null,
      behavioral_class: p?.behavioral_class ?? null,
      xp: p?.xp ?? 0,
      streak: p?.streak ?? 0,
      friend_code: p?.friend_code ?? null,
      last_quest_at: lastAt,
      inactive_days: inactive,
    };
  });
}

export async function sendMission(input: {
  orientadorId: string;
  studentId: string;
  title: string;
  detail?: string;
  area_slug?: string;
  xp_reward?: number;
  due_at?: string | null;
}) {
  const { error } = await supabase.from("orientador_missions").insert({
    orientador_id: input.orientadorId,
    student_id: input.studentId,
    title: input.title,
    detail: input.detail ?? null,
    area_slug: input.area_slug ?? null,
    xp_reward: input.xp_reward ?? 50,
    due_at: input.due_at ?? null,
  });
  if (error) throw error;
}

export async function listMissionsForOrientador(
  orientadorId: string,
  studentId?: string,
) {
  let q = supabase
    .from("orientador_missions")
    .select("*")
    .eq("orientador_id", orientadorId)
    .order("created_at", { ascending: false });
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as OrientadorMission[];
}

export async function listMissionsForStudent(studentId: string) {
  const { data, error } = await supabase
    .from("orientador_missions")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrientadorMission[];
}

export async function completeOrientadorMission(missionId: string) {
  const { error } = await supabase
    .from("orientador_missions")
    .update({ status: "completed" })
    .eq("id", missionId);
  if (error) throw error;
}

export type StudentDeepSnapshot = {
  profile: {
    id: string;
    display_name: string | null;
    behavioral_class: string | null;
    xp: number;
    streak: number;
    brasas: number;
    avatar_url: string | null;
    gender_track: string | null;
    onboarding_complete: boolean;
  };
  areas: Array<{ area_slug: string; xp: number; level: number }>;
  xp_daily: Array<{ day: string; xp: number; events: number }>;
  missions: OrientadorMission[];
  habits: Array<{
    id: string;
    title: string;
    target_per_week: number;
    active: boolean;
    logs_30d: number;
  }>;
  rituals: Array<{ ritual_date: string; ritual_type: string }>;
  sleep: Array<{ log_date: string; hours: number | null; quality: number | null; mood: string | null }>;
  mood: Array<{ log_date: string; mood_score: number | null; tags: string[] | null }>;
  window_days: number;
  generated_at: string;
};

export async function getStudentDeepSnapshot(
  studentId: string,
): Promise<StudentDeepSnapshot> {
  const { data, error } = await supabase.rpc("orientador_student_snapshot", {
    _student: studentId,
  });
  if (error) throw error;
  return data as unknown as StudentDeepSnapshot;
}
