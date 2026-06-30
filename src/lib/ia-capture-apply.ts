// Shared apply logic for IA-Coletora audit writes.
// Used by the server route (auto-apply) and the server function (manual confirm).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PROFILE_UPDATABLE_FIELDS, type AllowedAction } from "@/lib/ia-capture";

// Low-risk actions auto-applied without user confirmation.
// profile.update and goal.create still require manual confirmation.
export const AUTO_APPLY_ACTIONS = new Set<AllowedAction>([
  "habit.create",
  "habit_log.today",
  "quest.create",
  "ritual.upsert",
  "scheduled_quest.create",
  "area_mission.complete",
]);

export type ApplyResult = { inserted_table?: string; inserted_id?: string };

export async function applyAction(
  supabase: SupabaseClient<Database>,
  userId: string,
  action: AllowedAction,
  payload: Record<string, unknown>,
): Promise<ApplyResult> {
  switch (action) {
    case "habit.create": {
      const title = String(payload.title ?? "").trim();
      if (!title) throw new Error("missing_title");
      const target = Math.max(1, Math.min(7, Number(payload.target_per_week ?? 3)));
      const { data, error } = await supabase
        .from("habits")
        .insert({
          user_id: userId,
          title,
          target_per_week: target,
          active: true,
          area_slug: String(payload.area ?? "geral"),
          icon: "flame",
        })
        .select("id")
        .single();
      if (error) throw error;
      return { inserted_table: "habits", inserted_id: data?.id };
    }
    case "habit_log.today": {
      const title = String(payload.habit_title ?? "").trim();
      if (!title) throw new Error("missing_habit_title");
      let { data: h } = await supabase
        .from("habits")
        .select("id")
        .eq("user_id", userId)
        .ilike("title", title)
        .maybeSingle();
      if (!h) {
        const { data: created, error: ce } = await supabase
          .from("habits")
          .insert({
            user_id: userId,
            title,
            target_per_week: 3,
            active: true,
            area_slug: "geral",
            icon: "flame",
          })
          .select("id")
          .single();
        if (ce) throw ce;
        h = created;
      }
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("habit_logs")
        .insert({
          habit_id: h!.id,
          user_id: userId,
          log_date: today,
          status: "completed",
        })
        .select("id")
        .single();
      if (error) throw error;
      return { inserted_table: "habit_logs", inserted_id: data?.id };
    }
    case "quest.create": {
      const title = String(payload.title ?? "").trim();
      if (!title) throw new Error("missing_title");
      const xp = Number(payload.xp_reward ?? 25);
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("daily_quests")
        .insert({
          user_id: userId,
          title,
          subtitle: "",
          area_slug: String(payload.area_slug ?? "geral"),
          xp_reward: xp,
          quest_date: today,
          status: "open",
        })
        .select("id")
        .single();
      if (error) throw error;
      return { inserted_table: "daily_quests", inserted_id: data?.id };
    }
    case "ritual.upsert": {
      const type = String(payload.ritual_type ?? "");
      const content = String(payload.content ?? "").trim();
      if (!["morning", "night"].includes(type) || !content) throw new Error("invalid_ritual");
      const today = new Date().toISOString().slice(0, 10);
      const row =
        type === "morning"
          ? { intention: content }
          : { reflections: { note: content } as unknown as never };
      const { data, error } = await supabase
        .from("ritual_logs")
        .upsert(
          {
            user_id: userId,
            ritual_type: type,
            ritual_date: today,
            ...row,
          },
          { onConflict: "user_id,ritual_date,ritual_type" },
        )
        .select("id")
        .single();
      if (error) throw error;
      return { inserted_table: "ritual_logs", inserted_id: data?.id };
    }
    case "goal.create": {
      const title = String(payload.title ?? "").trim();
      if (!title) throw new Error("missing_title");
      const quarter = String(payload.horizon ?? payload.quarter ?? "trimestre");
      const { data, error } = await supabase
        .from("strategic_goals")
        .insert({
          user_id: userId,
          title,
          quarter,
          status: "active",
          description: (payload.description as string) ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return { inserted_table: "strategic_goals", inserted_id: data?.id };
    }
    case "scheduled_quest.create": {
      const title = String(payload.title ?? "").trim();
      const date = String(payload.scheduled_for ?? payload.scheduled_date ?? "");
      if (!title || !date) throw new Error("missing_fields");
      const { data, error } = await supabase
        .from("scheduled_quests")
        .insert({
          user_id: userId,
          title,
          scheduled_date: date,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      return { inserted_table: "scheduled_quests", inserted_id: data?.id };
    }
    case "area_mission.complete": {
      const area = String(payload.area_slug ?? "");
      const missionId = String(payload.mission_id ?? "");
      if (!area || !missionId) throw new Error("missing_fields");
      const { data, error } = await supabase
        .from("area_mission_logs")
        .insert({
          user_id: userId,
          area_slug: area,
          mission_id: missionId,
        })
        .select("id")
        .single();
      if (error) throw error;
      return { inserted_table: "area_mission_logs", inserted_id: data?.id };
    }
    case "profile.update": {
      const safe: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (PROFILE_UPDATABLE_FIELDS.has(k)) safe[k] = v;
      }
      if (Object.keys(safe).length === 0) throw new Error("no_fields");
      const { error } = await supabase
        .from("profiles")
        .update(safe as never)
        .eq("id", userId);
      if (error) throw error;
      return { inserted_table: "profiles", inserted_id: userId };
    }
    default:
      throw new Error("unknown_action");
  }
}
