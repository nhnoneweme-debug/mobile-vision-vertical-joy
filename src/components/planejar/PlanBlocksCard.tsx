// Card com blocos de execução propostos pela WiMi no framework Planejar.
// Deixa o usuário editar/remover blocos e enviá-los pro /executar como
// missões one_off do dia (aparecem imediatamente na timeline).

import { useState } from "react";
import { Loader2, Rocket, Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { createMission } from "@/lib/missions";
import { toast } from "sonner";
import type { ParsedPlanBlock } from "@/lib/wimi-memory";

type EditableBlock = ParsedPlanBlock & { _key: string };

function normalizeHM(s: string | null | undefined): string {
  if (!s) return "";
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export function PlanBlocksCard({ blocks }: { blocks: ParsedPlanBlock[] }) {
  const nav = useNavigate();
  const [rows, setRows] = useState<EditableBlock[]>(() =>
    blocks.map((b, i) => ({
      ...b,
      start: normalizeHM(b.start),
      end: normalizeHM(b.end),
      _key: `${i}-${Math.random().toString(36).slice(2, 7)}`,
    })),
  );
  const [busy, setBusy] = useState(false);

  if (rows.length === 0) return null;

  const patch = (key: string, p: Partial<EditableBlock>) =>
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...p } : r)));
  const remove = (key: string) =>
    setRows((prev) => prev.filter((r) => r._key !== key));

  async function send() {
    if (busy) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sem sessão.");
      for (const b of rows) {
        const title = b.title.trim();
        if (!title) continue;
        await createMission(uid, {
          title,
          notes: b.notes ?? undefined,
          area_slug: b.area || null,
          mission_type: "one_off",
          scheduled_time: b.start || null,
          end_time: b.end || null,
        });
      }
      toast.success("Plano enviado pro Executar", {
        description: `${rows.length} bloco(s) no palco de hoje.`,
      });
      void nav({ to: "/executar" });
    } catch (e) {
      toast.error("Não consegui salvar o plano", {
        description: (e as Error)?.message ?? "Tenta de novo em instantes.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-ember/40 bg-ember/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Rocket className="h-4 w-4 text-ember" />
        <span className="font-display text-[10px] uppercase tracking-[0.2em] text-ember">
          Plano proposto · edite e envie
        </span>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r._key} className="rounded-xl border border-border bg-charcoal-800/50 p-2.5">
            <div className="flex items-start gap-2">
              <input
                value={r.title}
                onChange={(e) => patch(r._key, { title: e.target.value })}
                className="flex-1 rounded-md border border-border bg-charcoal-900 px-2 py-1.5 text-sm text-foreground focus:border-ember/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => remove(r._key)}
                aria-label="Remover bloco"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <label className="flex items-center gap-1">
                início
                <input
                  type="time"
                  value={r.start ?? ""}
                  onChange={(e) => patch(r._key, { start: e.target.value })}
                  className="rounded border border-border bg-charcoal-900 px-1.5 py-0.5 text-[11px] text-foreground"
                />
              </label>
              <label className="flex items-center gap-1">
                fim
                <input
                  type="time"
                  value={r.end ?? ""}
                  onChange={(e) => patch(r._key, { end: e.target.value })}
                  className="rounded border border-border bg-charcoal-900 px-1.5 py-0.5 text-[11px] text-foreground"
                />
              </label>
              <input
                value={r.area ?? ""}
                onChange={(e) => patch(r._key, { area: e.target.value })}
                placeholder="área"
                className="w-20 rounded border border-border bg-charcoal-900 px-1.5 py-0.5 text-[11px] text-foreground"
              />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => void send()}
        disabled={busy || rows.length === 0}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ember px-3 py-2 font-display text-xs uppercase tracking-wider text-charcoal-900 active:scale-95 disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
        Enviar pro Executar
      </button>
    </div>
  );
}
