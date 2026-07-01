import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Check, CheckCheck, RefreshCw, Trash2, Flame, Moon, Sun, Target, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import {
  deleteNotification,
  generateMyNudges,
  listNotifications,
  markAllRead,
  markRead,
  type Notification,
} from "@/lib/notifications";
import {
  disablePush,
  enablePush,
  getPushPermission,
  hasActivePushSubscription,
  isPushSupported,
} from "@/lib/push";
import { sendTestPush } from "@/lib/push.functions";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Personal IA" },
      { name: "description", content: "Cutucadas inteligentes: missões pendentes, streak em risco, rituais e mensagens do orientador." },
    ],
  }),
  component: NotificacoesPage,
});

const ICONS: Record<string, React.ReactNode> = {
  mission_due: <Target className="h-4 w-4 text-ember" />,
  streak_risk: <Flame className="h-4 w-4 text-ember" />,
  night_ritual: <Moon className="h-4 w-4 text-indigo-400" />,
  morning_ritual: <Sun className="h-4 w-4 text-amber-400" />,
  orientador_mission: <Sparkles className="h-4 w-4 text-emerald-400" />,
};

function NotificacoesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushPerm, setPushPerm] = useState<NotificationPermission>("default");
  const [pushBusy, setPushBusy] = useState(false);
  const navigate = useNavigate();
  const testPush = useServerFn(sendTestPush);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    if (isPushSupported()) {
      void getPushPermission().then(setPushPerm);
      void hasActivePushSubscription().then(setPushOn);
    }
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const rows = await listNotifications(userId);
      setItems(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      // Ao abrir a caixa, geramos nudges de contexto atual
      generateMyNudges()
        .catch(() => 0)
        .finally(() => void load());
    }
  }, [userId, load]);

  async function handleRefresh() {
    if (!userId) return;
    setRefreshing(true);
    try {
      const n = await generateMyNudges();
      await load();
      toast.success(n > 0 ? `${n} nova(s) notificação(ões)` : "Nada novo por ora");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleOpen(n: Notification) {
    if (!n.read_at) {
      try { await markRead(n.id); } catch { /* silent */ }
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
    if (n.link) navigate({ to: n.link });
  }

  async function handleMarkAll() {
    if (!userId) return;
    try {
      await markAllRead(userId);
      setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteNotification(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  async function handleEnablePush() {
    setPushBusy(true);
    try {
      const r = await enablePush();
      if (!r.ok) {
        toast.error(
          r.error === "permission_denied"
            ? "Permissão negada no navegador"
            : r.error === "not_supported"
              ? "Push não suportado neste navegador"
              : r.error === "not_authenticated"
                ? "Faça login novamente"
                : r.error ?? "Erro",
        );
      } else {
        setPushOn(true);
        setPushPerm("granted");
        toast.success("Push ativado neste aparelho");
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function handleDisablePush() {
    setPushBusy(true);
    try {
      await disablePush();
      setPushOn(false);
      toast.success("Push desativado");
    } finally {
      setPushBusy(false);
    }
  }

  async function handleTestPush() {
    setPushBusy(true);
    try {
      const r = await testPush();
      const sent = (r as { sent?: number })?.sent ?? 0;
      if (sent > 0) toast.success(`Push de teste enviado (${sent} aparelho${sent > 1 ? "s" : ""})`);
      else toast.error("Nenhum aparelho inscrito");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setPushBusy(false);
    }
  }

  const unread = items.filter((x) => !x.read_at).length;

  return (
    <MobileShell>
      <div className="px-4 pt-4 pb-32">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-display text-[10px] tracking-[0.3em] text-ember">CAIXA DE ENTRADA</p>
            <h1 className="mt-1 flex items-center gap-2 font-display text-2xl tracking-wide text-foreground">
              <Bell className="h-6 w-6 text-ember" /> Notificações
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {unread > 0 ? `${unread} não lida(s)` : "Tudo em dia"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-full border border-border p-2 text-muted-foreground disabled:opacity-50"
            aria-label="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </header>

        {isPushSupported() && (
          <div className="mb-4 rounded-2xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-[10px] tracking-[0.3em] text-ember">PUSH NO CELULAR</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pushOn
                    ? "Ativo neste aparelho. Você recebe alertas mesmo com o app fechado."
                    : pushPerm === "denied"
                      ? "Bloqueado no navegador — libere nas permissões do site."
                      : "Ative para receber cutucadas mesmo com o app fechado."}
                </p>
              </div>
              {pushOn ? (
                <button
                  type="button"
                  onClick={handleDisablePush}
                  disabled={pushBusy}
                  className="shrink-0 rounded-full border border-border p-2 text-muted-foreground disabled:opacity-50"
                  aria-label="Desativar push"
                >
                  <BellOff className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={pushBusy || pushPerm === "denied"}
                  className="shrink-0 rounded-full bg-ember px-3 py-1.5 font-display text-[10px] tracking-[0.25em] text-background disabled:opacity-50"
                >
                  ATIVAR
                </button>
              )}
            </div>
            {pushOn && (
              <button
                type="button"
                onClick={handleTestPush}
                disabled={pushBusy}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 font-display text-[10px] tracking-[0.25em] text-muted-foreground disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" /> ENVIAR PUSH DE TESTE
              </button>
            )}
            <Link
              to="/preferencias-notificacoes"
              className="mt-2 block text-center font-display text-[10px] tracking-[0.25em] text-ember"
            >
              AJUSTAR CATEGORIAS E SILÊNCIO →
            </Link>
          </div>
        )}



        {unread > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 font-display text-[10px] tracking-[0.25em] text-muted-foreground"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            MARCAR TODAS COMO LIDAS
          </button>
        )}

        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Carregando…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma cutucada por enquanto.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Toque em atualizar para checar rituais, missões e streaks.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li
                key={n.id}
                className={`rounded-2xl border p-3 ${
                  n.read_at ? "border-border bg-card opacity-70" : "border-ember/40 bg-ember/5"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleOpen(n)}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                    {ICONS[n.kind] ?? <Bell className="h-4 w-4 text-muted-foreground" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm tracking-wide text-foreground">{n.title}</p>
                    {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground/60">
                      {new Date(n.created_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                    </p>
                  </div>
                </button>
                <div className="mt-2 flex justify-end gap-1">
                  {!n.read_at && (
                    <button
                      type="button"
                      onClick={() => { void markRead(n.id); setItems((p) => p.map((x) => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)); }}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-emerald-400"
                      aria-label="Marcar lida"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDelete(n.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-ember"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}
