import { useEffect, useState } from "react";
import { Check, ChevronDown, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMissions,
  maskToDays,
  toggleMissionToday,
  type UserMissionWithMeta,
} from "@/lib/missions";

/**
 * Checklist de fechamento do dia, dentro do dump da noite.
 *
 * Fechar o dia sem olhar o que foi combinado vira memória seletiva — a pessoa
 * lembra do que falhou. A lista traz os compromissos de HOJE pra confirmar o
 * que saiu, e o que ficou marcado entra no contexto que a IA já lê.
 *
 * Começa recolhida: o dump é conversa, a checklist é apoio.
 */
export function DayChecklist() {
  const [missions, setMissions] = useState<UserMissionWithMeta[] | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || !active) return;
      setUserId(data.user.id);
      try {
        const all = await listMissions(data.user.id);
        const hoje = new Date().getDay();
        // Só o que estava combinado pra hoje — o resto não é fechamento deste dia.
        const doDia = all.filter(
          (m) =>
            m.active && (m.mission_type === "one_off" || maskToDays(m.weekday_mask).includes(hoje)),
        );
        if (active) setMissions(doDia);
      } catch {
        if (active) setMissions([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function toggle(m: UserMissionWithMeta) {
    if (!userId || busy) return;
    setBusy(m.id);
    // Otimista: marcar precisa responder na hora, é o gesto principal daqui.
    setMissions((prev) =>
      prev ? prev.map((x) => (x.id === m.id ? { ...x, done_today: !x.done_today } : x)) : prev,
    );
    try {
      await toggleMissionToday(m, userId);
    } catch {
      setMissions((prev) =>
        prev ? prev.map((x) => (x.id === m.id ? { ...x, done_today: m.done_today } : x)) : prev,
      );
    } finally {
      setBusy(null);
    }
  }

  if (!missions || missions.length === 0) return null;

  const feitos = missions.filter((m) => m.done_today).length;

  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-border bg-charcoal-800/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <ListChecks className="h-4 w-4 shrink-0 text-indigo-400" strokeWidth={2.2} />
        <span className="min-w-0 flex-1 truncate font-display text-[11px] tracking-[0.15em] text-foreground">
          FECHAR O DIA
        </span>
        <span className="shrink-0 font-display text-[11px] text-indigo-400">
          {feitos}/{missions.length}
        </span>
        <ChevronDown
          className={
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform " +
            (open ? "rotate-180" : "")
          }
          strokeWidth={2.2}
        />
      </button>

      {open && (
        <div className="max-h-44 space-y-1 overflow-y-auto px-2 pb-2" data-lenis-prevent>
          {missions.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m)}
              disabled={busy === m.id}
              aria-pressed={m.done_today}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-charcoal-800 disabled:opacity-50"
            >
              <span
                className={
                  "grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors " +
                  (m.done_today
                    ? "border-indigo-400 bg-indigo-400 text-charcoal-900"
                    : "border-border bg-charcoal-900")
                }
              >
                {m.done_today && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              <span
                className={
                  "min-w-0 flex-1 truncate text-[13px] " +
                  (m.done_today ? "text-muted-foreground line-through" : "text-foreground")
                }
              >
                {m.title}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
