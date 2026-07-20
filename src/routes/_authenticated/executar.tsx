import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Check, ChevronRight, Clock, Pause, Play, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/shell/MobileShell";
import { supabase } from "@/integrations/supabase/client";
import { listScheduled, updateScheduledStatus, type ScheduledQuest } from "@/lib/planning";
import {
  clearMissionToday,
  isScheduledToday,
  listMissions,
  markMissionToday,
  type UserMissionWithMeta,
} from "@/lib/missions";
import { formatMomentLabel, getClientMoment } from "@/lib/client-moment";

export const Route = createFileRoute("/_authenticated/executar")({
  head: () => ({
    meta: [
      { title: "Executar — WiMi" },
      { name: "description", content: "Kanban de execução com a WiMi supervisionando o seu dia." },
    ],
  }),
  component: ExecutarPage,
});

type Col = "planejado" | "andamento" | "feito";
type ExecutionSource = "mission" | "scheduled";
type ExecutionStatus = "planned" | "done" | "skipped";
type ExecutionItem = {
  key: string;
  source: ExecutionSource;
  id: string;
  title: string;
  subtitle: string | null;
  time: string | null;
  status: ExecutionStatus;
  xp_reward: number;
  raw: UserMissionWithMeta | ScheduledQuest;
};

const IN_PROGRESS_KEY = "wimi:executar:andamento";
const LAST_CHECKIN_KEY = "wimi:executar:lastCheckin";

function readInProgress(): Set<string> {
  try {
    const raw = localStorage.getItem(IN_PROGRESS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}
function writeInProgress(s: Set<string>) {
  try {
    localStorage.setItem(IN_PROGRESS_KEY, JSON.stringify([...s]));
  } catch {}
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeTime(t: string | null | undefined): string | null {
  if (!t) return null;
  return t.slice(0, 5);
}

function missionStatus(m: UserMissionWithMeta): ExecutionStatus {
  if (m.done_today) return "done";
  if (m.skipped_today) return "skipped";
  return "planned";
}

function toMissionItem(m: UserMissionWithMeta): ExecutionItem {
  const time = normalizeTime(m.scheduled_time);
  return {
    key: `mission:${m.id}`,
    source: "mission",
    id: m.id,
    title: m.title,
    subtitle: [time ? `${time}${m.end_time ? `–${normalizeTime(m.end_time)}` : ""}` : null, m.notes]
      .filter(Boolean)
      .join(" · ") || null,
    time,
    status: missionStatus(m),
    xp_reward: m.xp_reward,
    raw: m,
  };
}

function toScheduledItem(q: ScheduledQuest): ExecutionItem {
  return {
    key: `scheduled:${q.id}`,
    source: "scheduled",
    id: q.id,
    title: q.title,
    subtitle: q.subtitle,
    time: null,
    status: q.status === "done" || q.status === "skipped" ? q.status : "planned",
    xp_reward: q.xp_reward,
    raw: q,
  };
}

function ExecutarPage() {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [items, setItems] = useState<ExecutionItem[]>([]);
  const [inProgress, setInProgress] = useState<Set<string>>(() => readInProgress());
  const [now, setNow] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState(true);
  const promptedRef = useRef<Set<string>>(new Set());

  const loadToday = useCallback(async (userId: string) => {
    const today = new Date();
    const [missions, scheduled] = await Promise.all([
      listMissions(userId),
      listScheduled(userId, today, today),
    ]);
    const missionItems = missions.filter(isScheduledToday).map(toMissionItem);
    const scheduledItems = scheduled.map(toScheduledItem);
    setItems(
      [...missionItems, ...scheduledItems].sort((a, b) => {
        const at = a.time ?? "99:99";
        const bt = b.time ?? "99:99";
        if (at !== bt) return at.localeCompare(bt);
        return a.title.localeCompare(b.title);
      }),
    );
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id;
      if (!id || !active) {
        if (active) setLoading(false);
        return;
      }
      setUid(id);
      try {
        await loadToday(id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar quests");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadToday]);

  const columns = useMemo(() => {
    const planejado: ExecutionItem[] = [];
    const andamento: ExecutionItem[] = [];
    const feito: ExecutionItem[] = [];
    for (const q of items) {
      if (q.status === "done" || q.status === "skipped") feito.push(q);
      else if (inProgress.has(q.key) || inProgress.has(q.id)) andamento.push(q);
      else planejado.push(q);
    }
    return { planejado, andamento, feito };
  }, [items, inProgress]);

  // Supervisão ativa — dispara um toast a cada nova hora se houver algo em andamento
  useEffect(() => {
    const hourKey = `${now.getHours()}`;
    let last = "";
    try {
      last = localStorage.getItem(LAST_CHECKIN_KEY) ?? "";
    } catch {}
    const stamp = `${todayIso()}:${hourKey}`;
    if (last === stamp) return;
    if (columns.andamento.length === 0 && columns.planejado.length === 0) return;
    const target = columns.andamento[0] ?? columns.planejado[0];
    if (!target || promptedRef.current.has(target.id + stamp)) return;
    promptedRef.current.add(target.id + stamp);
    try {
      localStorage.setItem(LAST_CHECKIN_KEY, stamp);
    } catch {}
    toast(`Check-in da WiMi · ${target.title}`, {
      description: "Como está indo? Confirma o progresso.",
      action: {
        label: "Feito",
        onClick: () => void moveTo(target, "feito"),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, columns.andamento.length, columns.planejado.length]);

  async function moveTo(q: ExecutionItem, col: Col) {
    const nextInProgress = new Set(inProgress);
    if (col === "andamento") {
      nextInProgress.add(q.key);
      setInProgress(nextInProgress);
      writeInProgress(nextInProgress);
      if (q.status !== "planned") {
        try {
          if (q.source === "scheduled") await updateScheduledStatus(q.id, "planned");
          else if (uid) await clearMissionToday(q.raw as UserMissionWithMeta, uid);
          if (uid) await loadToday(uid);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Erro");
        }
      }
      return;
    }
    if (col === "planejado") {
      nextInProgress.delete(q.key);
      nextInProgress.delete(q.id);
      setInProgress(nextInProgress);
      writeInProgress(nextInProgress);
      if (q.status !== "planned") {
        try {
          if (q.source === "scheduled") await updateScheduledStatus(q.id, "planned");
          else if (uid) await clearMissionToday(q.raw as UserMissionWithMeta, uid);
          if (uid) await loadToday(uid);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Erro");
        }
      }
      return;
    }
    // feito
    nextInProgress.delete(q.key);
    nextInProgress.delete(q.id);
    setInProgress(nextInProgress);
    writeInProgress(nextInProgress);
    try {
      if (q.source === "scheduled") await updateScheduledStatus(q.id, "done");
      else if (uid) await markMissionToday(q.raw as UserMissionWithMeta, uid, true);
      if (uid) await loadToday(uid);
      toast.success("Feito! +XP");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function markSkipped(q: ExecutionItem) {
    const next = new Set(inProgress);
    next.delete(q.key);
    next.delete(q.id);
    setInProgress(next);
    writeInProgress(next);
    try {
      if (q.source === "scheduled") await updateScheduledStatus(q.id, "skipped");
      else if (uid) await markMissionToday(q.raw as UserMissionWithMeta, uid, false);
      if (uid) await loadToday(uid);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  function askWimi(seed: "executar" | "planejar" = "executar") {
    navigate({ to: "/assistente", search: { seed } as never });
  }

  const focus = columns.andamento[0] ?? columns.planejado[0] ?? null;
  const clock = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <MobileShell>
      <header className="sticky top-0 z-20 border-b border-border bg-charcoal-900/85 px-4 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-ember" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl tracking-wide">EXECUTAR</h1>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="font-display tracking-widest text-foreground">{clock}</span>
              <span className="truncate">· {formatMomentLabel(getClientMoment())}</span>
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-5 px-4 py-5 pb-32">
        {/* Supervisor da WiMi */}
        <section className="forge-card rounded-2xl border border-ember/30 bg-ember/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.15em] text-ember">
            <Sparkles className="h-3.5 w-3.5" />
            WiMi supervisiona
          </div>
          {focus ? (
            <>
              <p className="text-sm text-foreground">
                Agora ({clock}) — como está{" "}
                <span className="font-display uppercase text-ember">{focus.title}</span>
                {focus.subtitle ? <span className="text-muted-foreground"> · {focus.subtitle}</span> : null}?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!inProgress.has(focus.key) && !inProgress.has(focus.id) && focus.status === "planned" && (
                  <button
                    onClick={() => void moveTo(focus, "andamento")}
                    className="flex items-center gap-1 rounded-full bg-ember px-3 py-1.5 text-xs font-medium text-charcoal-900"
                  >
                    <Play className="h-3 w-3" /> Estou fazendo
                  </button>
                )}
                <button
                  onClick={() => void moveTo(focus, "feito")}
                  className="flex items-center gap-1 rounded-full border border-ember/40 bg-ember/10 px-3 py-1.5 text-xs text-ember"
                >
                  <Check className="h-3 w-3" /> Já concluí
                </button>
                <button
                  onClick={() => void markSkipped(focus)}
                  className="flex items-center gap-1 rounded-full border border-border bg-charcoal-800/60 px-3 py-1.5 text-xs text-muted-foreground"
                >
                  <X className="h-3 w-3" /> Não vai rolar
                </button>
                <button
                  onClick={() => askWimi("executar")}
                  className="flex items-center gap-1 rounded-full border border-border bg-charcoal-800/60 px-3 py-1.5 text-xs text-muted-foreground"
                >
                  Ajustar com a WiMi <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Sem compromissos planejados pra hoje. Peça pra WiMi montar sua execução.
              </p>
              <button
                onClick={() => askWimi("planejar")}
                className="mt-3 flex items-center gap-1 rounded-full bg-ember px-3 py-1.5 text-xs font-medium text-charcoal-900"
              >
                <Sparkles className="h-3 w-3" /> Planejar agora
              </button>
            </>
          )}
        </section>

        {loading ? (
          <div className="rounded-xl border border-border bg-charcoal-800/40 p-6 text-center text-sm text-muted-foreground">
            Carregando…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <KanbanCol
              title="A fazer"
              tone="muted"
              items={columns.planejado}
              renderActions={(q) => (
                <>
                  <IconBtn label="Iniciar" onClick={() => void moveTo(q, "andamento")}>
                    <Play className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn label="Feito" onClick={() => void moveTo(q, "feito")}>
                    <Check className="h-3.5 w-3.5" />
                  </IconBtn>
                </>
              )}
            />
            <KanbanCol
              title="Em andamento"
              tone="ember"
              items={columns.andamento}
              renderActions={(q) => (
                <>
                  <IconBtn label="Pausar" onClick={() => void moveTo(q, "planejado")}>
                    <Pause className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn label="Feito" onClick={() => void moveTo(q, "feito")}>
                    <Check className="h-3.5 w-3.5" />
                  </IconBtn>
                </>
              )}
            />
            <KanbanCol
              title="Concluído"
              tone="done"
              items={columns.feito}
              renderActions={(q) => (
                <IconBtn label="Reabrir" onClick={() => void moveTo(q, "planejado")}>
                  <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                </IconBtn>
              )}
            />
          </div>
        )}

        <div className="pt-1 text-center">
          <Link
            to="/agenda"
            className="text-[11px] font-display uppercase tracking-[0.15em] text-muted-foreground underline-offset-4 hover:underline"
          >
            Ver agenda completa
          </Link>
        </div>
      </div>
    </MobileShell>
  );
}

function KanbanCol({
  title,
  tone,
  items,
  renderActions,
}: {
  title: string;
  tone: "muted" | "ember" | "done";
  items: ExecutionItem[];
  renderActions: (q: ExecutionItem) => React.ReactNode;
}) {
  const toneCls =
    tone === "ember"
      ? "border-ember/30 bg-ember/5"
      : tone === "done"
        ? "border-border/60 bg-charcoal-800/30 opacity-80"
        : "border-border bg-charcoal-800/40";
  return (
    <section className={`rounded-2xl border p-3 ${toneCls}`}>
      <header className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h2>
        <span className="text-[10px] text-muted-foreground">{items.length}</span>
      </header>
      {items.length === 0 ? (
        <p className="py-3 text-center text-[11px] text-muted-foreground">Vazio</p>
      ) : (
        <ul className="space-y-2">
          {items.map((q) => (
            <li
              key={q.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-charcoal-900/60 p-2.5"
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm ${
                    q.status === "done" || q.status === "skipped"
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }`}
                >
                  {q.title}
                </p>
                <p className="mt-0.5 font-display text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {q.time ? `${q.time} · ` : ""}{q.source === "mission" ? "Agenda" : "Quest"}{q.status === "skipped" ? " · não rolou" : ""}
                </p>
                {q.subtitle ? (
                  <p className="truncate text-[11px] text-muted-foreground">{q.subtitle}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">{renderActions(q)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-full border border-border bg-charcoal-800/60 text-muted-foreground active:scale-95"
    >
      {children}
    </button>
  );
}
