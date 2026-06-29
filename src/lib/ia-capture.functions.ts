import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROFILE_UPDATABLE_FIELDS, type AllowedAction } from "@/lib/ia-capture";

type ApplyInput = { audit_id: string };

export const applyAuditWrite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ApplyInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: audit, error } = await supabase
      .from("ai_audit_log")
      .select("*")
      .eq("id", data.audit_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !audit) throw new Error("audit_not_found");
    if (audit.status !== "pending") throw new Error("already_resolved");

    const action = audit.action as AllowedAction;
    const payload = (audit.payload ?? {}) as Record<string, unknown>;
    let result: unknown = null;

    try {
      switch (action) {
        case "habit.create": {
          const title = String(payload.title ?? "").trim();
          const target = Number(payload.target_per_week ?? 3);
          if (!title) throw new Error("missing_title");
          const { data: r, error: e } = await supabase
            .from("habits")
            .insert({
              user_id: userId,
              title,
              target_per_week: Math.max(1, Math.min(7, target)),
              active: true,
              xp_reward: 10,
            })
            .select("id")
            .single();
          if (e) throw e;
          result = r;
          break;
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
              .insert({ user_id: userId, title, target_per_week: 3, active: true, xp_reward: 10 })
              .select("id")
              .single();
            if (ce) throw ce;
            h = created;
          }
          const today = new Date().toISOString().slice(0, 10);
          const { data: r, error: e } = await supabase
            .from("habit_logs")
            .insert({ habit_id: h!.id, user_id: userId, log_date: today, status: "completed", xp_reward: 10 })
            .select("id")
            .single();
          if (e) throw e;
          result = r;
          break;
        }
        case "quest.create": {
          const title = String(payload.title ?? "").trim();
          if (!title) throw new Error("missing_title");
          const xp = Number(payload.xp_reward ?? 25);
          const today = new Date().toISOString().slice(0, 10);
          const { data: r, error: e } = await supabase
            .from("daily_quests")
            .insert({
              user_id: userId,
              title,
              xp_reward: xp,
              quest_date: today,
              status: "open",
              source: "ia_capture",
            })
            .select("id")
            .single();
          if (e) throw e;
          result = r;
          break;
        }
        case "ritual.upsert": {
          const type = String(payload.ritual_type ?? "");
          const content = String(payload.content ?? "").trim();
          if (!["morning", "night"].includes(type) || !content) throw new Error("invalid_ritual");
          const today = new Date().toISOString().slice(0, 10);
          const { data: r, error: e } = await supabase
            .from("ritual_logs")
            .upsert(
              { user_id: userId, ritual_type: type, ritual_date: today, content },
              { onConflict: "user_id,ritual_type,ritual_date" },
            )
            .select("id")
            .single();
          if (e) throw e;
          result = r;
          break;
        }
        case "goal.create": {
          const title = String(payload.title ?? "").trim();
          const horizon = String(payload.horizon ?? "quarter");
          if (!title) throw new Error("missing_title");
          const { data: r, error: e } = await supabase
            .from("strategic_goals")
            .insert({
              user_id: userId,
              title,
              horizon,
              target_date: (payload.target_date as string) ?? null,
              status: "active",
            })
            .select("id")
            .single();
          if (e) throw e;
          result = r;
          break;
        }
        case "scheduled_quest.create": {
          const title = String(payload.title ?? "").trim();
          const date = String(payload.scheduled_for ?? "");
          if (!title || !date) throw new Error("missing_fields");
          const { data: r, error: e } = await supabase
            .from("scheduled_quests")
            .insert({ user_id: userId, title, scheduled_for: date, status: "pending" })
            .select("id")
            .single();
          if (e) throw e;
          result = r;
          break;
        }
        case "area_mission.complete": {
          const area = String(payload.area_slug ?? "");
          const missionId = String(payload.mission_id ?? "");
          if (!area || !missionId) throw new Error("missing_fields");
          const { data: r, error: e } = await supabase
            .from("area_mission_logs")
            .insert({ user_id: userId, area_slug: area, mission_id: missionId })
            .select("id")
            .single();
          if (e) throw e;
          result = r;
          break;
        }
        case "profile.update": {
          const safe: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(payload)) {
            if (PROFILE_UPDATABLE_FIELDS.has(k)) safe[k] = v;
          }
          if (Object.keys(safe).length === 0) throw new Error("no_fields");
          const { data: r, error: e } = await supabase
            .from("profiles")
            .update(safe)
            .eq("id", userId)
            .select("id")
            .single();
          if (e) throw e;
          result = r;
          break;
        }
        default:
          throw new Error("unknown_action");
      }

      await supabase
        .from("ai_audit_log")
        .update({ status: "applied", result: result as never })
        .eq("id", data.audit_id);

      return { ok: true, result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "apply_failed";
      await supabase
        .from("ai_audit_log")
        .update({ status: "error", reason: msg })
        .eq("id", data.audit_id);
      throw new Error(msg);
    }
  });

export const rejectAuditWrite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ApplyInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ai_audit_log")
      .update({ status: "rejected" })
      .eq("id", data.audit_id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });
