// TIMELINE DE HOJE — SÓ O EXECUTADO.
//
// Decisão de produto (Fatia 3.4.4): a timeline NÃO mostra plano nenhum. Plano
// vive no ambiente de planejar. Aqui entra exclusivamente o que foi
// REGISTRADO: logs de jornada, marcos de sessão, manifestações reagidas,
// registros manuais (mic/câmera/dump), o registro noturno do dia e os sonhos
// do amanhecer. Cronológico, tocável, e vazio honesto quando não houve nada.

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  Mic,
  MessageSquareText,
  MoonStar,
  NotebookPen,
  Radio,
  Sparkles,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getExecutionLogRange, type ExecutionEventRow } from "@/lib/execution.functions";

type Icon = typeof Radio;

export type TimelineEntry = {
  key: string;
  minOfDay: number;
  time: string;
  kindLabel: string;
  title: string;
  detail: string | null;
  icon: Icon;
  highlight: boolean;
  storagePath?: string | null;
};

function fmtHM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function metaOf(row: ExecutionEventRow): Record<string, unknown> {
  return row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
    ? (row.meta as Record<string, unknown>)
    : {};
}

/** Eventos que contam como linha do tempo real (o resto é ruído técnico). */
const RELEVANT: ExecutionEventRow["kind"][] = [
  "journey_log",
  "journey_log_declined",
  "manual_log",
  "day_review",
  "mission_started",
  "mission_ended",
  "mission_done",
  "mission_skipped",
  "mission_extended",
  "manifest_ack",
  "manifest_shown",
  "voice_note",
  "negotiation",
  "dialog_turn",
];


function describe(row: ExecutionEventRow): {
  kindLabel: string;
  title: string;
  icon: Icon;
  highlight: boolean;
} {
  const meta = metaOf(row);
  const t = (meta.title as string | undefined) ?? "bloco";
  switch (row.kind) {
    case "manual_log": {
      const mode = meta.mode as string | undefined;
      if (mode === "camera")
        return {
          kindLabel: "registro · foto",
          title: (meta.caption as string | null) || "foto registrada",
          icon: Camera,
          highlight: true,
        };
      if (mode === "mic")
        return {
          kindLabel: "registro · voz",
          title: row.note?.slice(0, 120) ?? "registro falado",
          icon: Mic,
          highlight: true,
        };
      return {
        kindLabel: "registro · dump",
        title: row.note?.slice(0, 120) ?? "dump",
        icon: NotebookPen,
        highlight: true,
      };
    }
    case "day_review":
      return {
        kindLabel: "registro do dia",
        title: row.note?.slice(0, 120) ?? "registro do dia",
        icon: MoonStar,
        highlight: true,
      };
    case "journey_log":
      return {
        kindLabel: "registro de jornada",
        title: row.note?.slice(0, 120) ?? "registro",
        icon: MessageSquareText,
        highlight: true,
      };
    case "journey_log_declined":
      return {
        kindLabel: "registro de jornada",
        title: "adiado pelo usuário",
        icon: MessageSquareText,
        highlight: false,
      };
    case "voice_note":
      return {
        kindLabel: "nota de voz",
        title: row.note?.slice(0, 120) ?? "nota de voz",
        icon: Mic,
        highlight: true,
      };
    case "mission_started":
      return { kindLabel: "evento", title: `iniciou · ${t}`, icon: Radio, highlight: false };
    case "mission_ended":
      return { kindLabel: "evento", title: `encerrou · ${t}`, icon: Radio, highlight: false };
    case "mission_done":
      return { kindLabel: "evento", title: `feito · ${t}`, icon: Radio, highlight: false };
    case "mission_skipped":
      return { kindLabel: "evento", title: `pulado · ${t}`, icon: Radio, highlight: false };
    case "mission_extended":
      return {
        kindLabel: "evento",
        title: `estendido ${row.delta_min && row.delta_min > 0 ? "+" : ""}${row.delta_min ?? 0}min · ${t}`,
        icon: Radio,
        highlight: false,
      };
    case "manifest_ack":
      return { kindLabel: "evento", title: `reagiu · ${t}`, icon: Sparkles, highlight: false };
    case "manifest_shown":
      return {
        kindLabel: "evento",
        title: `WiMi se manifestou · ${t}`,
        icon: Sparkles,
        highlight: false,
      };
    default:
      return { kindLabel: "evento", title: row.kind, icon: Radio, highlight: false };
  }
}

type DreamRow = { id: string; raw_text: string; mood: string | null; created_at: string };

/** Entradas de hoje — exportado pro ritual da noite ancorar a conversa. */
export function useTodayEntries(): TimelineEntry[] {
  const fn = useServerFn(getExecutionLogRange);

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

  // Sonhos do amanhecer vivem no dream_logs existente — entram na timeline
  // do novo dia sem duplicar o fluxo de /despertar/sonho.
  const { data: dreams } = useQuery<DreamRow[]>({
    queryKey: ["execution-log", "dreams", range.dayKey],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("dream_logs")
        .select("id, raw_text, mood, created_at")
        .gte("created_at", range.from)
        .lte("created_at", range.to)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (rows ?? []) as DreamRow[];
    },
    staleTime: 60_000,
  });

  return useMemo<TimelineEntry[]>(() => {
    const fromEvents = (data ?? [])
      .filter((r) => RELEVANT.includes(r.kind))
      .map((r) => {
        const d = new Date(r.occurred_at);
        const minOfDay = d.getHours() * 60 + d.getMinutes();
        const { kindLabel, title, icon, highlight } = describe(r);
        const meta = metaOf(r);
        return {
          key: r.id,
          minOfDay,
          time: fmtHM(minOfDay),
          kindLabel,
          title,
          detail: r.note ?? null,
          icon,
          highlight,
          storagePath: (meta.storage_path as string | undefined) ?? null,
        } satisfies TimelineEntry;
      });

    const fromDreams = (dreams ?? []).map((d) => {
      const at = new Date(d.created_at);
      const minOfDay = at.getHours() * 60 + at.getMinutes();
      return {
        key: `dream-${d.id}`,
        minOfDay,
        time: fmtHM(minOfDay),
        kindLabel: d.mood === "pesadelo" ? "pesadelo" : "sonho",
        title: d.raw_text.slice(0, 120),
        detail: d.raw_text,
        icon: MoonStar,
        highlight: true,
      } satisfies TimelineEntry;
    });

    return [...fromEvents, ...fromDreams].sort((a, b) => a.minOfDay - b.minOfDay);
  }, [data, dreams]);
}

function PhotoDetail({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase.storage
      .from("execution-media")
      .createSignedUrl(path, 300)
      .then(({ data }) => {
        if (alive) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  if (!url) return <p className="mt-3 text-[12px] text-muted-foreground">carregando a foto…</p>;
  return (
    <img
      src={url}
      alt="Foto registrada na timeline de hoje"
      className="mt-3 w-full rounded-xl border border-border"
    />
  );
}

export function TodayTimeline({ onRegister }: { onRegister?: () => void }) {
  const entries = useTodayEntries();
  const [open, setOpen] = useState<TimelineEntry | null>(null);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-charcoal-800/40 p-6 text-center">
        <p className="text-sm text-muted-foreground">Nada registrado ainda hoje.</p>
        {onRegister ? (
          <button
            type="button"
            onClick={onRegister}
            className="mt-3 rounded-full border border-ember/40 bg-ember/10 px-4 py-2 text-xs text-ember active:scale-95"
          >
            Registrar agora
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <ol className="space-y-2">
        {entries.map((e) => {
          const Icon = e.icon;
          return (
            <li key={e.key}>
              <button
                type="button"
                onClick={() => setOpen(e)}
                className={[
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition active:scale-[0.99]",
                  e.highlight ? "border-ember/50 bg-ember/10" : "border-border bg-charcoal-800/40",
                ].join(" ")}
              >
                <span className="w-10 shrink-0 font-display text-[11px] tabular-nums text-muted-foreground">
                  {e.time}
                </span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border/60 bg-charcoal-900/70">
                  <Icon
                    className={`h-4 w-4 ${e.highlight ? "text-ember" : "text-muted-foreground"}`}
                  />
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
            {open.storagePath ? <PhotoDetail path={open.storagePath} /> : null}
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {open.detail ?? "Sem detalhe adicional registrado."}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
