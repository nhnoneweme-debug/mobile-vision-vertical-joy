import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROFILE_UPDATABLE_FIELDS, type AllowedAction } from "@/lib/ia-capture";

type ApplyInput = { audit_id: string };

export const applyAuditWrite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ApplyInput) => d)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
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

    try {
      switch (action) {
        case "habit.create": {
          const title = String(payload.title ?? "").trim();
          if (!title) throw new Error("missing_title");
          const target = Math.max(1, Math.min(7, Number(payload.target_per_week ?? 3)));
          const { error: e } = await supabase.from("habits").insert({
            user_id: userId,
            title,
            target_per_week: target,
            active: true,
            area_slug: String(payload.area ?? "geral"),
            icon: "flame",
          });
          if (e) throw e;
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
          const { error: e } = await supabase.from("habit_logs").insert({
            habit_id: h!.id,
            user_id: userId,
            log_date: today,
            status: "completed",
          });
          if (e) throw e;
          break;
        }
        case "quest.create": {
          const title = String(payload.title ?? "").trim();
          if (!title) throw new Error("missing_title");
          const xp = Number(payload.xp_reward ?? 25);
          const today = new Date().toISOString().slice(0, 10);
          const { error: e } = await supabase.from("daily_quests").insert({
            user_id: userId,
            title,
            xp_reward: xp,
            quest_date: today,
            status: "open",
          });
          if (e) throw e;
          break;
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
          const { error: e } = await supabase
            .from("ritual_logs")
            .upsert(
              {
                user_id: userId,
                ritual_type: type,
                ritual_date: today,
                ...row,
              },
              { onConflict: "user_id,ritual_date,ritual_type" },
            );
          if (e) throw e;
          break;
        }
        case "goal.create": {
          const title = String(payload.title ?? "").trim();
          if (!title) throw new Error("missing_title");
          const quarter = String(payload.horizon ?? payload.quarter ?? "trimestre");
          const { error: e } = await supabase.from("strategic_goals").insert({
            user_id: userId,
            title,
            quarter,
            status: "active",
            description: (payload.description as string) ?? null,
          });
          if (e) throw e;
          break;
        }
        case "scheduled_quest.create": {
          const title = String(payload.title ?? "").trim();
          const date = String(payload.scheduled_for ?? payload.scheduled_date ?? "");
          if (!title || !date) throw new Error("missing_fields");
          const { error: e } = await supabase.from("scheduled_quests").insert({
            user_id: userId,
            title,
            scheduled_date: date,
            status: "pending",
          });
          if (e) throw e;
          break;
        }
        case "area_mission.complete": {
          const area = String(payload.area_slug ?? "");
          const missionId = String(payload.mission_id ?? "");
          if (!area || !missionId) throw new Error("missing_fields");
          const { error: e } = await supabase.from("area_mission_logs").insert({
            user_id: userId,
            area_slug: area,
            mission_id: missionId,
          });
          if (e) throw e;
          break;
        }
        case "profile.update": {
          const safe: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(payload)) {
            if (PROFILE_UPDATABLE_FIELDS.has(k)) safe[k] = v;
          }
          if (Object.keys(safe).length === 0) throw new Error("no_fields");
          const { error: e } = await supabase
            .from("profiles")
            .update(safe as never)
            .eq("id", userId);
          if (e) throw e;
          break;
        }
        default:
          throw new Error("unknown_action");
      }

      await supabase
        .from("ai_audit_log")
        .update({ status: "applied" })
        .eq("id", data.audit_id);

      return { ok: true };
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
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ai_audit_log")
      .update({ status: "rejected" })
      .eq("id", data.audit_id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });
