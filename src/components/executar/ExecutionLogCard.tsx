// Card recolhível com o log da jornada de hoje.
// Fonte única de verdade — mesma tabela que a análise futura consome.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, ScrollText } from "lucide-react";
import { getTodayExecutionLog, type ExecutionEventRow } from "@/lib/execution.functions";

function labelFor(row: ExecutionEventRow): string {
  const meta = (
    row.meta && typeof row.meta === "object" && !Array.isArray(row.meta) ? row.meta : {}
  ) as {
    title?: string;
  };
  const title = meta.title ?? "bloco";
  switch (row.kind) {
    case "manifest_ack":
      return `reagiu · ${title}`;
    case "mission_done":
      return `feito · ${title}`;
    case "mission_skipped":
      return `pulado · ${title}`;
    case "mission_extended":
      return `estendido ${row.delta_min && row.delta_min > 0 ? "+" : ""}${row.delta_min ?? 0}min · ${title}`;
    case "voice_note":
      return `nota de voz · ${row.note?.slice(0, 60) ?? ""}`;
    case "manifest_shown":
      return `WiMi se manifestou · ${title}`;
    default:
      return row.kind;
  }
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ExecutionLogCard() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fn = useServerFn(getTodayExecutionLog);
  const { data } = useQuery<ExecutionEventRow[]>({
    queryKey: ["execution-log", "today"],
    queryFn: () => fn() as Promise<ExecutionEventRow[]>,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const rows = (data ?? []).filter((r: ExecutionEventRow) =>
    ["manifest_ack", "mission_done", "mission_skipped", "mission_extended", "voice_note"].includes(
      r.kind,
    ),
  );

  const list =
    rows.length === 0 ? (
      <p className="py-2 text-center text-[12px] text-muted-foreground">
        Nada registrado ainda hoje.
      </p>
    ) : (
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} className="flex gap-3 text-[12px]">
            <span className="w-10 shrink-0 font-display tabular-nums text-muted-foreground">
              {fmtTime(r.occurred_at)}
            </span>
            <span className="min-w-0 flex-1 text-foreground">{labelFor(r)}</span>
          </li>
        ))}
      </ul>
    );

  return (
    <section className="rounded-2xl border border-border bg-charcoal-800/40">
      <div className="flex w-full items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ScrollText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Registro
          </span>
          <span className="ml-auto rounded-full bg-charcoal-900/60 px-2 py-0.5 text-[10px] text-muted-foreground">
            {rows.length}
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>
        <ExpandButton onClick={() => setExpanded(true)} />
      </div>
      {open ? (
        <div className="border-t border-border/50 px-4 py-3">
          {/* Contido: ~5 linhas com rolagem interna — nunca empurra a página. */}
          <ScrollBox heightClass="max-h-32" stickKey={rows.length} className="pr-1">
            {list}
          </ScrollBox>
        </div>
      ) : null}
      {expanded ? (
        <ExpandedSheet title="Registro de hoje" onClose={() => setExpanded(false)}>
          {list}
        </ExpandedSheet>
      ) : null}
    </section>
  );
}

