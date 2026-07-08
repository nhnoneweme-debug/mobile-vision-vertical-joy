import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

type View = "mes" | "semana" | "dia";

const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"]; // Seg..Dom
const WEEKDAYS_FULL = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Segunda como início da semana (0=Seg ... 6=Dom)
function mondayIndex(jsDay: number) {
  return (jsDay + 6) % 7;
}

export function MonthGlance({
  marked = [],
  activitiesByWeekday = {},
}: {
  marked?: number[];
  activitiesByWeekday?: Record<number, string[]>;
}) {
  const [view, setView] = useState<View>("mes");
  const navigate = useNavigate();
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const todayDate = today.getDate();
  const markedSet = new Set(marked);
  const actsFor = (dayNum: number) => activitiesByWeekday[new Date(y, m, dayNum).getDay()] ?? [];

  const firstOffset = mondayIndex(new Date(y, m, 1).getDay());
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Altura da grade mensal — para que SEM e DIA tenham o MESMO tamanho, com scroll interno.
  const monthRows = Math.ceil(cells.length / 7);
  const monthHeight = monthRows * 46 + (monthRows - 1) * 4 + 18; // linhas + gaps + cabeçalho

  // Semana atual (segunda a domingo)
  const weekStart = new Date(y, m, todayDate - mondayIndex(today.getDay()));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  return (
    <section className="px-4 pt-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate({ to: "/agenda" })}
        className="forge-card cursor-pointer rounded-3xl p-4"
      >
        <header className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-display text-[10px] tracking-[0.3em] text-ember">SEU CALENDÁRIO</p>
            <h2 className="font-display text-2xl leading-none tracking-wide text-foreground">
              {MONTHS[m]} <span className="text-muted-foreground">{y}</span>
            </h2>
          </div>
          <div className="flex rounded-xl border border-border bg-charcoal-900 p-0.5">
            {(["mes", "semana", "dia"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={(e) => { e.stopPropagation(); setView(v); }}
                className={
                  "rounded-lg px-2.5 py-1 font-display text-[10px] tracking-[0.2em] transition-colors " +
                  (view === v ? "bg-ember text-charcoal-900" : "text-muted-foreground")
                }
              >
                {v === "mes" ? "MÊS" : v === "semana" ? "SEM" : "DIA"}
              </button>
            ))}
          </div>
        </header>

        {view === "mes" && (
          <>
            <div className="mb-1 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d, i) => (
                <span
                  key={i}
                  className="text-center font-display text-[10px] tracking-widest text-muted-foreground"
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (day === null) return <span key={i} />;
                const isToday = day === todayDate;
                const acts = actsFor(day);
                const isMarked = markedSet.has(day);
                return (
                  <div
                    key={i}
                    className={
                      "flex min-h-[46px] flex-col rounded-lg p-1 " +
                      (isToday ? "bg-ember text-charcoal-900" : "bg-charcoal-800/40 text-foreground/80")
                    }
                  >
                    <span className="flex items-center gap-1 font-display text-[11px] leading-none">
                      {day}
                      {isMarked && (
                        <span
                          className={
                            "h-1 w-1 rounded-full " + (isToday ? "bg-charcoal-900" : "bg-ember")
                          }
                        />
                      )}
                    </span>
                    {acts.length > 0 && (
                      <span
                        className={
                          "mt-0.5 truncate text-[7px] leading-tight " +
                          (isToday ? "text-charcoal-900/80" : "text-ember")
                        }
                      >
                        {acts[0]}{acts.length > 1 ? ` +${acts.length - 1}` : ""}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {view === "semana" && (
          <div className="overflow-y-auto pr-1" style={{ height: monthHeight }}>
            <div className="space-y-1.5">
              {weekDays.map((d, i) => {
                const isToday = d.toDateString() === today.toDateString();
                const acts = activitiesByWeekday[d.getDay()] ?? [];
                return (
                  <div
                    key={i}
                    className={
                      "rounded-xl border p-2 " +
                      (isToday ? "border-ember/50 bg-charcoal-900" : "border-border")
                    }
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={
                          "grid h-6 w-6 shrink-0 place-items-center rounded-md font-display text-xs " +
                          (isToday ? "bg-ember text-charcoal-900" : "bg-charcoal-800 text-foreground")
                        }
                      >
                        {d.getDate()}
                      </span>
                      <span className="font-display text-[10px] tracking-[0.2em] text-muted-foreground">
                        {WEEKDAYS_FULL[i]}
                      </span>
                      {acts.length > 0 && (
                        <span className="ml-auto font-display text-[9px] tracking-[0.15em] text-ember">
                          {acts.length}
                        </span>
                      )}
                    </div>
                    {acts.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground">livre</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {acts.map((a, j) => (
                          <span
                            key={j}
                            className="rounded-md bg-ember/10 px-1.5 py-0.5 text-[10px] leading-tight text-ember"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "dia" && (() => {
          const acts = activitiesByWeekday[today.getDay()] ?? [];
          return (
            <div className="overflow-y-auto pr-1" style={{ height: monthHeight }}>
              <div className="mb-2 flex items-center gap-3 rounded-xl border border-ember/30 bg-charcoal-900 p-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ember font-display text-lg text-charcoal-900">
                  {todayDate}
                </span>
                <div className="min-w-0">
                  <p className="font-display text-[9px] tracking-[0.3em] text-ember">HOJE</p>
                  <p className="truncate font-display text-sm tracking-wide text-foreground">
                    {WEEKDAYS_FULL[mondayIndex(today.getDay())]}, {todayDate} de {MONTHS[m]}
                  </p>
                </div>
                <span className="ml-auto shrink-0 font-display text-[10px] tracking-[0.15em] text-muted-foreground">
                  {acts.length} tarefa{acts.length === 1 ? "" : "s"}
                </span>
              </div>
              {acts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  Nada agendado para hoje.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {acts.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-xl border border-border bg-charcoal-900 px-3 py-2"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
                      <span className="text-sm leading-snug text-foreground">{a}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </section>
  );
}
