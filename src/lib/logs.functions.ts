import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type LogKind = "dream" | "ritual_morning" | "ritual_night" | "sleep" | "habit";

export type LogEntry = {
  id: string;
  kind: LogKind;
  /** Data do registro (YYYY-MM-DD) — é por ela que a lista agrupa e ordena. */
  date: string;
  title: string;
  body: string | null;
  /** Etiquetas curtas: símbolos do sonho, humor, qualidade do sono… */
  tags: string[];
};

const asText = (v: unknown): string | null => {
  if (typeof v === "string") return v.trim() || null;
  return null;
};

/**
 * Histórico unificado dos registros do usuário.
 *
 * Os dados já existiam espalhados (dream_logs, ritual_logs, sleep_logs,
 * habit_logs) sem nenhuma tela que os mostrasse junto — o Log é essa tela.
 * A agregação é feita aqui, no servidor, pra não fazer 4 round-trips do
 * cliente e pra manter a ordenação consistente.
 */
export const listLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(60) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<LogEntry[]> => {
    const db = context.supabase as Db;
    const uid = context.userId;
    const limit = data.limit;

    const [dreams, rituals, sleeps, habits] = await Promise.all([
      db
        .from("dream_logs")
        .select("id, raw_text, ai_summary, mood, symbols, themes, logged_at")
        .eq("user_id", uid)
        .order("logged_at", { ascending: false })
        .limit(limit),
      db
        .from("ritual_logs")
        .select("id, ritual_date, ritual_type, intention, reflections")
        .eq("user_id", uid)
        .order("ritual_date", { ascending: false })
        .limit(limit),
      db
        .from("sleep_logs")
        .select("id, date, bed_at, sleep_at, wake_at, quality, notes")
        .eq("user_id", uid)
        .order("date", { ascending: false })
        .limit(limit),
      db
        .from("habit_logs")
        .select("id, log_date, status, habit_id, habits(title)")
        .eq("user_id", uid)
        .order("log_date", { ascending: false })
        .limit(limit),
    ]);

    const out: LogEntry[] = [];

    for (const d of dreams.data ?? []) {
      out.push({
        id: `dream:${d.id}`,
        kind: "dream",
        date: String(d.logged_at).slice(0, 10),
        title: asText(d.ai_summary) ?? "Sonho registrado",
        body: asText(d.raw_text),
        tags: [asText(d.mood), ...(d.symbols ?? []), ...(d.themes ?? [])].filter(
          (x): x is string => !!x,
        ),
      });
    }

    for (const r of rituals.data ?? []) {
      const refl = (r.reflections ?? {}) as Record<string, unknown>;
      const partes = Object.values(refl)
        .map(asText)
        .filter((x): x is string => !!x);
      out.push({
        id: `ritual:${r.id}`,
        kind: r.ritual_type === "morning" ? "ritual_morning" : "ritual_night",
        date: r.ritual_date,
        title:
          asText(r.intention) ?? (r.ritual_type === "morning" ? "Ritual da manhã" : "Fechou o dia"),
        body: partes.join(" · ") || null,
        tags: [],
      });
    }

    for (const s of sleeps.data ?? []) {
      // Sem nenhum dado útil, não polui a lista.
      if (!s.bed_at && !s.sleep_at && !s.wake_at && s.quality == null && !s.notes) continue;
      const hhmm = (v: string | null) => (v ? String(v).slice(11, 16) : null);
      const trecho = [
        hhmm(s.sleep_at) && `dormiu ${hhmm(s.sleep_at)}`,
        hhmm(s.wake_at) && `acordou ${hhmm(s.wake_at)}`,
      ].filter(Boolean);
      out.push({
        id: `sleep:${s.id}`,
        kind: "sleep",
        date: s.date,
        title: trecho.join(" · ") || "Sono registrado",
        body: asText(s.notes),
        tags: s.quality != null ? [`qualidade ${s.quality}/5`] : [],
      });
    }

    for (const h of habits.data ?? []) {
      const titulo = (h.habits as { title?: string } | null)?.title;
      out.push({
        id: `habit:${h.id}`,
        kind: "habit",
        date: h.log_date,
        title: titulo ?? "Hábito",
        body: null,
        tags: h.status && h.status !== "completed" ? [String(h.status)] : [],
      });
    }

    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return out.slice(0, limit);
  });
