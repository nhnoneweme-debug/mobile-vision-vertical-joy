// TIMELINE DE HOJE — a linha do tempo REAL do usuário.
// Mescla o que foi REGISTRADO (execution_events do dia local: logs de jornada,
// marcos de sessão, manifestações, notas) com os blocos PLANEJADOS.
// Registros em destaque; planejado em tom apagado. Tocar abre o detalhe.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Circle, MessageSquareText, Radio, Sparkles, X } from "lucide-react";
import { getExecutionLogRange, type ExecutionEventRow } from "@/lib/execution.functions";
import type { TimelineItem } from "./JourneyTimeline";

type Entry = {
  key: string;
  minOfDay: number;
  time: string;
  kindLabel: string;
  title: string;
  detail: string | null;
  variant: "log" | "event" | "planned";
  plannedState?: TimelineItem["state"];
};

function fmtHM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function metaTitle(row: ExecutionEventRow): string | null {
  const m = (
    row.meta && typeof row.meta === "object" && !Array.isArray(row.meta) ? row.meta : {}
  ) as { title?: string };
  return m.title ?? null;
}

/** Eventos que contam como linha do tempo real (o resto é ruído técnico). */
const RELEVANT: ExecutionEventRow["kind"][] = [
  "journey_log",
  "journey_log_declined",
  "mission_started",
  "mission_ended",
  "mission_done",
  "mission_skipped",
  "mission_extended",
  "manifest_ack",
  "manifest_shown",
  "voice_note",
  "negotiation",
];

function describe(row: ExecutionEventRow): { kindLabel: string; title: string } {
  const t = metaTitle(row) ?? "bloco";
  switch (row.kind) {
    case "journey_log":
      return { kindLabel: "registro de jornada", title: row.note?.slice(0, 120) ?? "registro" };
    case "journey_log_declined":
      return { kindLabel: "registro de jornada", title: "adiado pelo usuário" };
    case "mission_started":
      return { kindLabel: "evento", title: `iniciou · ${t}` };
    case "mission_ended":
      return { kindLabel: "evento", title: `encerrou · ${t}` };
    case "mission_done":
      return { kindLabel: "evento", title: `feito · ${t}` };
    case "mission_skipped":
      return { kindLabel: "evento", title: `pulado · ${t}` };
    case "mission_extended":
      return {
        kindLabel: "evento",
        title: `estendido ${row.delta_min && row.delta_min > 0 ? "+" : ""}${row.delta_min ?? 0}min · ${t}`,
      };
    case "manifest_ack":
      return { kindLabel: "evento", title: `reagiu · ${t}` };
    case "manifest_shown":
      return { kindLabel: "evento", title: `WiMi se manifestou · ${t}` };
    case "voice_note":
      return { kindLabel: "registro de jornada", title: row.note?.slice(0, 120) ?? "nota de voz" };
    default:
      return { kindLabel: "evento", title: row.kind };
  }
}

export function TodayTimeline({ planned }: { planned: TimelineItem[] }) {
  const fn = useServerFn(getExecutionLogRange);

  // Dia corrente no FUSO LOCAL do aparelho.
  const range = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString(), dayKey: start.toDateString() };
  }, []);

  const { data } = useQuery<ExecutionEventRow[]>({
    queryKey: ["execution-log", "range", range.dayKey],
    queryFn: () => fn({ data: { from: range.from, to: range.to } }) as Promise<ExecutionEventRow[]>,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const [open, setOpen] = useState<Entry | null>(null);

  const rows = useMemo(
    () => (data ?? []).filter((r) => RELEVANT.includes(r.kind)),
    [data],
  );

  const entries = useMemo<Entry[]>(() => {
    const fromEvents: Entry[] = rows.map((r) => {
      const d = new Date(r.occurred_at);
      const minOfDay = d.getHours() * 60 + d.getMinutes();
      const { kindLabel, title } = describe(r);
      const isLog = r.kind === "journey_log" || r.kind === "journey_log_declined" || r.kind === "voice_note";
      return {
        key: r.id,
        minOfDay,
        time: fmtHM(minOfDay),
        kindLabel,
        title,
        detail: r.note ?? null,
        variant: isLog ? "log" : "event",
      };
    });

    const fromPlanned: Entry[] = planned.map(({ block, state }) => ({
      key: `plan-${block.id}`,
      minOfDay: block.startMin,
      time: fmtHM(block.startMin),
      kindLabel: "bloco planejado",
      title: block.title,
      detail: `${fmtHM(block.startMin)}–${fmtHM(block.endMin)}${block.area ? ` · ${block.area}` : ""}`,
      variant: "planned",
      plannedState: state,
    }));

    return [...fromEvents, ...fromPlanned].sort((a, b) => a.minOfDay - b.minOfDay);
  }, [rows, planned]);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-charcoal-800/40 p-6 text-center text-sm text-muted-foreground">
        Ainda não há nada hoje — nem plano, nem registro. Quando você começar, a linha do tempo
        nasce aqui.
      </div>
    );
  }

  return (
    <>
      {rows.length === 0 ? (
        <p className="mb-2 text-[11px] text-muted-foreground">sem registros ainda hoje</p>
      ) : null}
      <ol className="space-y-2">
        {entries.map((e) => {
          const isPlanned = e.variant === "planned";
          const isLog = e.variant === "log";
          return (
            <li key={e.key}>
              <button
                type="button"
                onClick={() => setOpen(e)}
                className={[
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition active:scale-[0.99]",
                  isLog
                    ? "border-ember/50 bg-ember/10"
                    : isPlanned
                      ? "border-border/40 bg-charcoal-800/30 opacity-60"
                      : "border-border bg-charcoal-800/40",
                ].join(" ")}
              >
                <span className="w-10 shrink-0 font-display text-[11px] tabular-nums text-muted-foreground">
                  {e.time}
                </span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border/60 bg-charcoal-900/70">
                  {isLog ? (
                    <MessageSquareText className="h-4 w-4 text-ember" />
                  ) : isPlanned ? (
                    e.plannedState === "done" ? (
                      <Check className="h-4 w-4 text-muted-foreground" />
                    ) : e.plannedState === "now" ? (
                      <Sparkles className="h-4 w-4 text-ember" />
                    ) : (
                      <Circle className="h-3 w-3 text-muted-foreground" />
                    )
                  ) : (
                    <Radio className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{e.title}</span>
                  <span className="mt-0.5 block font-display text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {e.kindLabel}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal-950/70 p-0 backdrop-blur-sm">
          <div className="max-h-[80vh] w-full max-w-[var(--shell-max,480px)] overflow-y-auto rounded-t-3xl border border-border bg-charcoal-900 p-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-display text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {open.time} · {open.kindLabel}
                </p>
                <h4 className="mt-1 text-base text-foreground">{open.title}</h4>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label="Fechar"
                className="shrink-0 rounded-full border border-border p-2 text-muted-foreground active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {open.detail ?? "Sem detalhe adicional registrado."}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
