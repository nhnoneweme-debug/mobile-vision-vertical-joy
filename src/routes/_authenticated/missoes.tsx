import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellRing, CalendarDays, Check, Clock, Copy, Flame, Link2, Link2Off, ListChecks, Pencil, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { MobileShell } from "@/components/shell/MobileShell";
import { supabase } from "@/integrations/supabase/client";
import { XPToast } from "@/components/map/XPToast";
import {
  MISSION_PRESETS,
  WEEKDAY_LABELS,
  archiveMission,
  createMission,
  duplicateMission,
  formatMask,
  isScheduledToday,
  listMissions,
  toggleDay,
  toggleMissionToday,
  updateMission,
  type MissionInput,
  type MissionPreset,
  type MissionType,
  type UserMissionWithMeta,
} from "@/lib/missions";
import { AREAS } from "@/components/map/areas";
import {
  getGoogleCalendarAuthUrl,
  exchangeGoogleCode,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  syncMissionsToCalendar,
  toggleCalendarSync,
} from "@/lib/google-calendar.functions";

export const Route = createFileRoute("/_authenticated/missoes")({
  head: () => ({
    meta: [
      { title: "Minhas Missões — Personal IA" },
      {
        name: "description",
        content:
          "Crie, agende e acompanhe suas missões diárias e semanais com lembretes no celular.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    area: typeof s.area === "string" ? s.area : undefined,
    new: s.new === "1" || s.new === 1 || s.new === true ? true : undefined,
    gcal: typeof s.gcal === "string" ? s.gcal : undefined,
    code: typeof s.code === "string" ? s.code : undefined,
  }),
  component: MissoesPage,
});

type Tab = "today" | "week" | "all";

function MissoesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const fnGetAuthUrl = useServerFn(getGoogleCalendarAuthUrl);
  const fnExchangeCode = useServerFn(exchangeGoogleCode);
  const fnDisconnect = useServerFn(disconnectGoogleCalendar);
  const fnGetGCalStatus = useServerFn(getGoogleCalendarStatus);
  const fnSyncToCalendar = useServerFn(syncMissionsToCalendar);
  const fnToggleSync = useServerFn(toggleCalendarSync);

  const [userId, setUserId] = useState<string | null>(null);
  const [missions, setMissions] = useState<UserMissionWithMeta[]>([]);
  const [tab, setTab] = useState<Tab>("today");
  const [composerOpen, setComposerOpen] = useState<boolean>(!!search.new);
  const [editing, setEditing] = useState<UserMissionWithMeta | null>(null);
  const [presetArea, setPresetArea] = useState<string | undefined>(search.area);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [xpToast, setXpToast] = useState<{ amount: number; leveledUp: boolean } | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalSyncEnabled, setGcalSyncEnabled] = useState(false);
  const [gcalSyncing, setGcalSyncing] = useState(false);

  const refresh = useCallback(async (uid: string) => {
    const rows = await listMissions(uid);
    setMissions(rows);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      try {
        await refresh(data.user.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar missões");
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  // Google Calendar: troca código OAuth + verifica status
  useEffect(() => {
    (async () => {
      try {
        const status = await fnGetGCalStatus();
        setGcalConnected(!!status.connected);
        setGcalSyncEnabled(!!(status as { sync_enabled?: boolean }).sync_enabled);
      } catch {
        /* noop */
      }
      if (search.gcal === "success" && search.code) {
        try {
          await fnExchangeCode({ data: { code: search.code } });
          toast.success("Google Calendar conectado.");
          setGcalConnected(true);
          setGcalSyncEnabled(true);
          navigate({
            to: "/missoes",
            search: { area: search.area, new: search.new, gcal: undefined, code: undefined },
            replace: true,
          });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Erro ao conectar Google Calendar");
          navigate({
            to: "/missoes",
            search: { area: search.area, new: search.new, gcal: undefined, code: undefined },
            replace: true,
          });
        }
      } else if (search.gcal === "error") {
        toast.error("Conexão com Google Calendar cancelada.");
        navigate({
          to: "/missoes",
          search: { area: search.area, new: search.new, gcal: undefined, code: undefined },
          replace: true,
        });
      }
    })();
  }, [search.gcal, search.code, fnExchangeCode, fnGetGCalStatus, navigate]);

  async function connectGoogleCalendar() {
    try {
      const { url } = await fnGetAuthUrl();
      window.open(url, "_blank", "width=500,height=700");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar URL de autorização");
    }
  }

  async function disconnectGCal() {
    try {
      await fnDisconnect();
      setGcalConnected(false);
      setGcalSyncEnabled(false);
      toast("Google Calendar desconectado.");
    } catch {
      toast.error("Erro ao desconectar.");
    }
  }

  async function syncNow() {
    setGcalSyncing(true);
    try {
      const res = await fnSyncToCalendar();
      toast.success(`${(res as { synced?: number }).synced ?? 0} missões sincronizadas.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao sincronizar.");
    } finally {
      setGcalSyncing(false);
    }
  }

  async function handleToggleSync(enabled: boolean) {
    setGcalSyncEnabled(enabled);
    try {
      await fnToggleSync({ data: { enabled } });
    } catch {
      toast.error("Erro ao alterar sincronização.");
      setGcalSyncEnabled(!enabled);
    }
  }

  // Agendador in-tab: dispara Notification quando bater o horário (± lembrete)
  useEffect(() => {
    if (notifPerm !== "granted") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const now = new Date();
    for (const m of missions) {
      if (!m.scheduled_time || !isScheduledToday(m) || m.done_today) continue;
      const [h, mi] = m.scheduled_time.split(":").map(Number);
      const when = new Date();
      when.setHours(h, mi, 0, 0);
      const remind = new Date(when.getTime() - m.remind_before_min * 60000);
      const delay = remind.getTime() - now.getTime();
      if (delay > 0 && delay < 12 * 3600 * 1000) {
        timers.push(
          setTimeout(() => {
            try {
              new Notification("Missão agora", {
                body: `${m.title}${m.remind_before_min > 0 ? ` · em ${m.remind_before_min} min` : ""}`,
                icon: "/icon-192.png",
                tag: `mission-${m.id}-${when.toDateString()}`,
              });
            } catch {}
          }, delay),
        );
      }
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, [missions, notifPerm]);

  const filtered = useMemo(() => {
    if (tab === "today") return missions.filter((m) => isScheduledToday(m));
    if (tab === "week") return missions.filter((m) => m.mission_type !== "one_off");
    return missions;
  }, [missions, tab]);

  async function onToggle(m: UserMissionWithMeta) {
    if (!userId || pending === m.id) return;
    setPending(m.id);
    const wasDone = m.done_today;
    try {
      await toggleMissionToday(m, userId);
      await refresh(userId);
      if (!wasDone) setXpToast({ amount: m.xp_reward, leveledUp: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setPending(null);
    }
  }

  async function onSave(input: MissionInput, id?: string) {
    if (!userId) return;
    try {
      if (id) await updateMission(id, input);
      else await createMission(userId, input);
      setComposerOpen(false);
      setEditing(null);
      setPresetArea(undefined);
      await refresh(userId);
      toast.success(id ? "Missão atualizada" : "Missão criada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function onArchive(id: string) {
    if (!userId) return;
    try {
      await archiveMission(id);
      await refresh(userId);
      toast.success("Missão arquivada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function onDuplicate(m: UserMissionWithMeta) {
    if (!userId) return;
    try {
      await duplicateMission(m, userId);
      await refresh(userId);
      toast.success("Missão duplicada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function askNotif() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotifPerm(p);
    if (p === "granted") toast.success("Lembretes ativados");
  }

  return (
    <MobileShell>
      <header className="sticky top-0 z-20 border-b border-border bg-charcoal-900/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <h1 className="font-display text-lg tracking-wide">MINHAS MISSÕES</h1>
            <p className="text-[11px] text-muted-foreground">
              Crie, agende e ganhe XP no seu ritmo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setComposerOpen(true);
            }}
            className="flex h-9 items-center gap-1 rounded-full bg-ember px-3 font-display text-[11px] tracking-[0.22em] text-charcoal-900 active:scale-95"
          >
            <Plus className="h-4 w-4" /> NOVA
          </button>
        </div>

        <div className="mt-3 flex gap-1 rounded-full border border-border bg-charcoal-900 p-1">
          {(
            [
              { k: "today", label: "HOJE" },
              { k: "week", label: "SEMANA" },
              { k: "all", label: "TODAS" },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              className={
                "flex-1 rounded-full px-3 py-1.5 font-display text-[11px] tracking-[0.2em] transition-colors " +
                (tab === t.k ? "bg-ember text-charcoal-900" : "text-muted-foreground")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="space-y-4 px-4 py-4 pb-32">
        {/* Google Calendar */}
        <div className="rounded-xl border border-border bg-charcoal-800/50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <CalendarDays
              className={
                "h-4 w-4 shrink-0 " + (gcalConnected ? "text-emerald-400" : "text-muted-foreground")
              }
            />
            <span className="flex-1 text-xs text-foreground">
              {gcalConnected ? "Google Calendar conectado" : "Google Calendar"}
            </span>
            {gcalConnected ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={syncNow}
                  disabled={gcalSyncing}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground active:scale-95 disabled:opacity-40"
                  aria-label="Sincronizar agora"
                >
                  <RefreshCw className={"h-3.5 w-3.5 " + (gcalSyncing ? "animate-spin" : "")} />
                </button>
                <button
                  type="button"
                  onClick={disconnectGCal}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-destructive active:scale-95"
                  aria-label="Desconectar Google Calendar"
                >
                  <Link2Off className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={connectGoogleCalendar}
                className="flex items-center gap-1 rounded-lg bg-ember px-2.5 py-1 font-display text-[10px] tracking-[0.18em] text-charcoal-900 active:scale-95"
              >
                <Link2 className="h-3.5 w-3.5" /> CONECTAR
              </button>
            )}
          </div>
          {gcalConnected ? (
            <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={gcalSyncEnabled}
                onChange={(e) => handleToggleSync(e.target.checked)}
                className="h-3.5 w-3.5 accent-ember"
              />
              Sincronizar missões automaticamente
            </label>
          ) : null}
        </div>

        {notifPerm !== "granted" && notifPerm !== "unsupported" && (
          <button
            type="button"
            onClick={askNotif}
            className="flex w-full items-center gap-2 rounded-xl border border-ember/40 bg-ember/10 px-3 py-2 text-left text-xs text-ember active:scale-[0.99]"
          >
            <BellRing className="h-4 w-4" />
            Ativar lembretes no celular para as missões agendadas
          </button>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-2xl border border-border bg-charcoal-900"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            tab={tab}
            onCreate={() => {
              setEditing(null);
              setComposerOpen(true);
            }}
            onPreset={(area) => {
              setPresetArea(area);
              setEditing(null);
              setComposerOpen(true);
            }}
          />
        ) : (
          <ul className="space-y-2">
            {filtered.map((m) => (
              <MissionRow
                key={m.id}
                m={m}
                pending={pending === m.id}
                onToggle={() => onToggle(m)}
                onEdit={() => {
                  setEditing(m);
                  setComposerOpen(true);
                }}
                onArchive={() => onArchive(m.id)}
                onDuplicate={() => onDuplicate(m)}
              />
            ))}
          </ul>
        )}
      </div>

      {composerOpen && (
        <Composer
          initial={editing}
          presetArea={presetArea}
          onCancel={() => {
            setComposerOpen(false);
            setEditing(null);
            setPresetArea(undefined);
          }}
          onSave={onSave}
        />
      )}

      {xpToast && (
        <XPToast
          amount={xpToast.amount}
          leveledUp={xpToast.leveledUp}
          onDone={() => setXpToast(null)}
        />
      )}
    </MobileShell>
  );
}

function MissionRow({
  m,
  pending,
  onToggle,
  onEdit,
  onArchive,
  onDuplicate,
}: {
  m: UserMissionWithMeta;
  pending: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDuplicate: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const areaName = AREAS.find((a) => a.slug === m.area_slug)?.name;
  return (
    <li
      className={
        "flex items-start gap-3 rounded-2xl border p-3 transition-colors " +
        (m.done_today ? "border-ember/40 bg-ember/5" : "border-border bg-card")
      }
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        aria-label={m.done_today ? "Desfazer" : "Marcar como feita"}
        className={
          "grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors " +
          (m.done_today
            ? "border-ember bg-ember text-charcoal-900"
            : "border-border bg-charcoal-900 text-muted-foreground active:bg-ember/20")
        }
      >
        <Check className="h-4 w-4" strokeWidth={2.6} />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={
            "font-display text-sm leading-tight tracking-wide " +
            (m.done_today ? "text-foreground/70 line-through" : "text-foreground")
          }
        >
          {m.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {m.scheduled_time && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {m.scheduled_time.slice(0, 5)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {formatMask(m.weekday_mask, m.mission_type)}
          </span>
          {m.remind_before_min > 0 && (
            <span className="flex items-center gap-1">
              <Bell className="h-3 w-3" />−{m.remind_before_min}min
            </span>
          )}
          {areaName && <span>· {areaName}</span>}
          <span className="flex items-center gap-1 text-ember">
            <Flame className="h-3 w-3" />+{m.xp_reward} XP
          </span>
        </div>
        {m.notes && <p className="mt-1 text-[11px] text-muted-foreground">{m.notes}</p>}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground active:bg-charcoal-800"
          aria-label="Ações"
        >
          <Pencil className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-9 z-10 flex w-40 flex-col overflow-hidden rounded-xl border border-border bg-charcoal-900 shadow-lg"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
              className="flex items-center gap-2 px-3 py-2 text-left text-xs text-foreground active:bg-charcoal-800"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDuplicate();
              }}
              className="flex items-center gap-2 px-3 py-2 text-left text-xs text-foreground active:bg-charcoal-800"
            >
              <Copy className="h-3.5 w-3.5" /> Duplicar
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onArchive();
              }}
              className="flex items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-red-400 active:bg-charcoal-800"
            >
              <Trash2 className="h-3.5 w-3.5" /> Arquivar
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function EmptyState({
  tab,
  onCreate,
  onPreset,
}: {
  tab: Tab;
  onCreate: () => void;
  onPreset: (area: string) => void;
}) {
  const msg =
    tab === "today"
      ? "Nenhuma missão programada para hoje."
      : tab === "week"
        ? "Nenhuma missão recorrente ainda."
        : "Você ainda não criou nenhuma missão.";
  return (
    <div className="space-y-4 rounded-2xl border border-dashed border-border bg-charcoal-900/40 p-6 text-center">
      <ListChecks className="mx-auto h-8 w-8 text-ember" />
      <p className="text-sm text-muted-foreground">{msg}</p>
      <button
        type="button"
        onClick={onCreate}
        className="mx-auto flex items-center gap-2 rounded-full bg-ember px-4 py-2 font-display text-[11px] tracking-[0.22em] text-charcoal-900 active:scale-95"
      >
        <Plus className="h-4 w-4" /> CRIAR MISSÃO
      </button>
      <div className="pt-2">
        <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
          OU COMECE POR UMA ÁREA
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {["treino", "cozinha", "quarto", "mental"].map((a) => {
            const info = AREAS.find((x) => x.slug === a);
            if (!info) return null;
            return (
              <button
                key={a}
                type="button"
                onClick={() => onPreset(a)}
                className="rounded-full border border-border bg-charcoal-800 px-3 py-1 text-xs text-foreground active:scale-95"
              >
                {info.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Composer (create/edit) ────────────────────────────────────────────────
function Composer({
  initial,
  presetArea,
  onCancel,
  onSave,
}: {
  initial: UserMissionWithMeta | null;
  presetArea?: string;
  onCancel: () => void;
  onSave: (input: MissionInput, id?: string) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [area, setArea] = useState<string | null>(initial?.area_slug ?? presetArea ?? null);
  const [type, setType] = useState<MissionType>(initial?.mission_type ?? "daily");
  const [time, setTime] = useState(initial?.scheduled_time?.slice(0, 5) ?? "");
  const [mask, setMask] = useState<number>(initial?.weekday_mask ?? 127);
  const [remind, setRemind] = useState<number>(initial?.remind_before_min ?? 0);
  const [xp, setXp] = useState<number>(initial?.xp_reward ?? 15);

  function applyPreset(p: MissionPreset) {
    setTitle(p.title);
    setArea(p.area_slug);
    setType(p.mission_type);
    setTime(p.scheduled_time ?? "");
    setMask(p.weekday_mask ?? 127);
    setXp(p.xp_reward);
    setNotes(p.notes ?? "");
  }

  const presetsForArea = presetArea
    ? MISSION_PRESETS.filter((p) => p.area_slug === presetArea)
    : [];

  function submit() {
    if (!title.trim()) return;
    onSave(
      {
        title,
        notes: notes || undefined,
        area_slug: area,
        mission_type: type,
        scheduled_time: time || null,
        weekday_mask: type === "one_off" ? 127 : mask,
        remind_before_min: remind,
        xp_reward: xp,
      },
      initial?.id,
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-auto max-h-[92vh] w-full max-w-[var(--shell-max)] overflow-y-auto rounded-t-2xl border border-border bg-charcoal-900 p-5 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg tracking-wide">
            {initial ? "EDITAR MISSÃO" : "NOVA MISSÃO"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground active:bg-charcoal-800"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!initial && presetsForArea.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
              PRESETS DA ÁREA
            </p>
            <div className="flex flex-wrap gap-2">
              {presetsForArea.map((p) => (
                <button
                  key={p.title}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="flex items-center gap-1 rounded-full border border-ember/30 bg-ember/5 px-3 py-1 text-xs text-ember active:scale-95"
                >
                  <Sparkles className="h-3 w-3" /> {p.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="block">
          <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
            TÍTULO
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Treino de força"
            maxLength={140}
            className="mt-1 w-full rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground outline-none focus:border-ember/60"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
              TIPO
            </span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MissionType)}
              className="mt-1 w-full rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground outline-none"
            >
              <option value="daily">Diária</option>
              <option value="weekly">Semanal</option>
              <option value="one_off">Única</option>
            </select>
          </label>
          <label className="block">
            <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
              ÁREA
            </span>
            <select
              value={area ?? ""}
              onChange={(e) => setArea(e.target.value || null)}
              className="mt-1 w-full rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground outline-none"
            >
              <option value="">(sem área)</option>
              {AREAS.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
              HORÁRIO
            </span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground outline-none"
            />
          </label>
          <label className="block">
            <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
              LEMBRAR ANTES (MIN)
            </span>
            <input
              type="number"
              min={0}
              max={240}
              value={remind}
              onChange={(e) => setRemind(Math.max(0, Math.min(240, Number(e.target.value) || 0)))}
              className="mt-1 w-full rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground outline-none"
            />
          </label>
        </div>

        {type !== "one_off" && (
          <div className="mt-3">
            <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
              DIAS
            </span>
            <div className="mt-1 flex gap-1">
              {WEEKDAY_LABELS.map((lbl, i) => {
                const on = (mask & (1 << i)) !== 0;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setMask(toggleDay(mask, i))}
                    className={
                      "flex-1 rounded-lg border py-2 font-display text-xs transition-colors " +
                      (on
                        ? "border-ember bg-ember/15 text-ember"
                        : "border-border bg-charcoal-800 text-muted-foreground")
                    }
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setMask(127)}
                className="rounded-full border border-border px-2 py-0.5 text-muted-foreground"
              >
                todos
              </button>
              <button
                type="button"
                onClick={() => setMask(62)}
                className="rounded-full border border-border px-2 py-0.5 text-muted-foreground"
              >
                seg–sex
              </button>
              <button
                type="button"
                onClick={() => setMask(65)}
                className="rounded-full border border-border px-2 py-0.5 text-muted-foreground"
              >
                fim de semana
              </button>
            </div>
          </div>
        )}

        <label className="mt-3 block">
          <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
            XP AO CONCLUIR
          </span>
          <input
            type="number"
            min={0}
            max={200}
            value={xp}
            onChange={(e) => setXp(Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
            className="mt-1 w-full rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground outline-none"
          />
        </label>

        <label className="mt-3 block">
          <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
            NOTAS
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Detalhes, carga, progressão…"
            className="mt-1 w-full resize-none rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground outline-none"
          />
        </label>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border bg-charcoal-800 py-3 font-display text-[11px] tracking-[0.22em] text-muted-foreground active:scale-[0.98]"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="flex-1 rounded-xl bg-ember py-3 font-display text-[11px] tracking-[0.22em] text-charcoal-900 disabled:opacity-40 active:scale-[0.98]"
          >
            SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}
