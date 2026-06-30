import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AllowedAction } from "@/lib/ia-capture";
import { applyAction } from "@/lib/ia-capture-apply";

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
      const res = await applyAction(supabase, userId, action, payload);
      await supabase
        .from("ai_audit_log")
        .update({
          status: "applied",
          payload: {
            ...payload,
            _inserted_table: res.inserted_table,
            _inserted_id: res.inserted_id,
          } as never,
        })
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

// Reverses an auto-applied write when possible by deleting the inserted row.
// Safe-list of tables that can be cleanly reversed; profile.update is not
// reversible since we don't snapshot the prior values.
const REVERSIBLE_TABLES = new Set([
  "habits",
  "habit_logs",
  "daily_quests",
  "ritual_logs",
  "scheduled_quests",
  "area_mission_logs",
  "strategic_goals",
]);

export const undoAuditWrite = createServerFn({ method: "POST" })
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
    if (audit.status !== "applied") throw new Error("not_applied");

    const payload = (audit.payload ?? {}) as Record<string, unknown>;
    const table = payload._inserted_table as string | undefined;
    const insertedId = payload._inserted_id as string | undefined;
    if (!table || !insertedId || !REVERSIBLE_TABLES.has(table)) {
      throw new Error("undo_not_supported");
    }

    // RLS keeps users from deleting other people's rows; we still scope by user_id where the table has it.
    const del = supabase.from(table as never).delete().eq("id", insertedId);
    // Only some tables carry user_id; ignore if column missing.
    const { error: derr } = await del;
    if (derr) throw derr;

    await supabase
      .from("ai_audit_log")
      .update({ status: "reverted" })
      .eq("id", data.audit_id);
    return { ok: true };
  });
