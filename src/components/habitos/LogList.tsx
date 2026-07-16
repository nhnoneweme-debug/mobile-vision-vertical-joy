import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Moon, Sunrise, BedDouble, Flame, ScrollText } from "lucide-react";
import { listLogs, type LogEntry, type LogKind } from "@/lib/logs.functions";

const META: Record<LogKind, { icon: typeof Moon; label: string; color: string }> = {
  dream: { icon: Sunrise, label: "SONHO", color: "text-amber-400" },
  ritual_morning: { icon: Sunrise, label: "MANHÃ", color: "text-amber-400" },
  ritual_night: { icon: Moon, label: "NOITE", color: "text-indigo-400" },
  sleep: { icon: BedDouble, label: "SONO", color: "text-indigo-400" },
  habit: { icon: Flame, label: "HÁBITO", color: "text-ember" },
};

const FILTROS: { id: "todos" | LogKind; label: string }[] = [
  { id: "todos", label: "TUDO" },
  { id: "dream", label: "SONHOS" },
  { id: "ritual_night", label: "DIA" },
  { id: "sleep", label: "SONO" },
  { id: "habit", label: "HÁBITOS" },
];

function formatarData(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const data = new Date(y, m - 1, d);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (data.toDateString() === hoje.toDateString()) return "Hoje";
  if (data.toDateString() === ontem.toDateString()) return "Ontem";
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

/** Consulta de tudo que foi registrado — dumps, rituais, sono e hábitos. */
export function LogList() {
  const fnListLogs = useServerFn(listLogs);
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [filtro, setFiltro] = useState<"todos" | LogKind>("todos");
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await fnListLogs({ data: { limit: 60 } });
        if (active) setEntries(rows);
      } catch {
        if (active) {
          setErro(true);
          setEntries([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [fnListLogs]);

  const filtrados = (entries ?? []).filter((e) => {
    if (filtro === "todos") return true;
    if (filtro === "ritual_night") return e.kind === "ritual_night" || e.kind === "ritual_morning";
    return e.kind === filtro;
  });

  // Agrupa por dia — o log é lido como uma linha do tempo.
  const porDia = filtrados.reduce<Record<string, LogEntry[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});

  if (entries === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-charcoal-800" />
        ))}
      </div>
    );
  }

  if (erro) {
    return (
      <p className="rounded-2xl border border-border bg-charcoal-900 px-4 py-8 text-center text-sm text-muted-foreground">
        Não consegui carregar seus registros agora. Puxe para atualizar.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={
              "shrink-0 rounded-full border px-3 py-1 font-display text-[10px] tracking-[0.15em] transition-colors " +
              (filtro === f.id
                ? "border-ember/50 bg-ember/10 text-ember"
                : "border-border text-muted-foreground")
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-border bg-charcoal-900 px-4 py-10 text-center">
          <ScrollText className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {filtro === "todos"
              ? "Nada registrado ainda. Faça um dump ao acordar ou antes de dormir."
              : "Nada desse tipo por aqui ainda."}
          </p>
        </div>
      ) : (
        Object.entries(porDia).map(([dia, itens]) => (
          <div key={dia}>
            <p className="mb-1.5 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
              {formatarData(dia).toUpperCase()}
            </p>
            <div className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-1.5 lg:space-y-0">
              {itens.map((e) => {
                const meta = META[e.kind];
                const Icon = meta.icon;
                return (
                  <div
                    key={e.id}
                    className="flex gap-3 rounded-2xl border border-border/60 bg-charcoal-900 px-3.5 py-3"
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.color}`} strokeWidth={2.2} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`shrink-0 font-display text-[9px] tracking-[0.2em] ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-sm text-foreground">{e.title}</p>
                      </div>
                      {e.body && (
                        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                          {e.body}
                        </p>
                      )}
                      {e.tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {e.tags.slice(0, 5).map((t, i) => (
                            <span
                              key={i}
                              className="rounded-md bg-charcoal-800 px-1.5 py-0.5 text-[9px] text-muted-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
