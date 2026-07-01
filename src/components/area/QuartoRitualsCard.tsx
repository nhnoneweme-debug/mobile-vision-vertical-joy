import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Plus, Moon, Check, Trash2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createMission,
  archiveMission,
  toggleMissionToday,
  type UserMissionWithMeta,
} from "@/lib/missions";
import { suggestQuartoRituals, type SuggestedRitual } from "@/lib/quarto-rituals.functions";

export function QuartoRitualsCard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [rituals, setRituals] = useState<UserMissionWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<SuggestedRitual[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("");

  const fnSuggest = useServerFn(suggestQuartoRituals);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setUserId(auth.user.id);
      await refresh(auth.user.id);
    })();
  }, []);

  async function refresh(uid: string) {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("user_missions")
      .select("*, user_mission_logs!left(done, log_date)")
      .eq("user_id", uid)
      .eq("area_slug", "quarto")
      .eq("active", true)
      .order("scheduled_time", { ascending: true, nullsFirst: false });
    const rows = (data ?? []).map((r: unknown) => {
      const row = r as UserMissionWithMeta & {
        user_mission_logs?: Array<{ done: boolean; log_date: string }>;
      };
      const todayLog = row.user_mission_logs?.find((l) => l.log_date === today);
      return { ...row, done_today: !!todayLog?.done } as UserMissionWithMeta;
    });
    setRituals(rows);
    setLoading(false);
  }

  async function handleSuggest() {
    setSuggesting(true);
    try {
      const s = await fnSuggest();
      setSuggestions(s);
      if (!s.length) toast.info("Sem sugestões no momento");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao sugerir");
    } finally {
      setSuggesting(false);
    }
  }

  async function acceptSuggestion(s: SuggestedRitual) {
    if (!userId) return;
    try {
      await createMission(userId, {
        title: s.title,
        notes: s.notes,
        area_slug: "quarto",
        mission_type: "daily",
        scheduled_time: s.scheduled_time,
        weekday_mask: 127,
        xp_reward: 10,
      });
      setSuggestions((prev) => prev.filter((x) => x !== s));
      await refresh(userId);
      toast.success("Ritual adicionado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function handleAdd() {
    if (!userId || newTitle.trim().length < 2) return;
    setAdding(true);
    try {
      await createMission(userId, {
        title: newTitle.trim(),
        area_slug: "quarto",
        mission_type: "daily",
        scheduled_time: newTime || null,
        weekday_mask: 127,
        xp_reward: 10,
      });
      setNewTitle("");
      setNewTime("");
      await refresh(userId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(m: UserMissionWithMeta) {
    if (!userId) return;
    try {
      await toggleMissionToday(m, userId);
      await refresh(userId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function handleArchive(m: UserMissionWithMeta) {
    if (!userId) return;
    try {
      await archiveMission(m.id);
      await refresh(userId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="rounded-2xl border border-ember/30 bg-ember/5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-ember" />
          <p className="font-display text-[10px] tracking-[0.3em] text-ember">
            RITUAIS DO QUARTO
          </p>
        </div>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={suggesting}
          className="flex items-center gap-1.5 rounded-lg border border-ember/40 bg-ember/10 px-2.5 py-1 font-display text-[10px] tracking-[0.2em] text-ember disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" />
          {suggesting ? "GERANDO…" : "IA SUGERIR"}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg border border-border bg-background/60 p-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Sugestões personalizadas
          </p>
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 rounded-md bg-background/80 px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{s.title}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {s.scheduled_time ? `@${s.scheduled_time} · ` : ""}
                  {s.notes}
                </p>
              </div>
              <button
                type="button"
                onClick={() => acceptSuggestion(s)}
                className="rounded-md bg-ember px-2 py-1 font-display text-[10px] tracking-[0.2em] text-charcoal-900"
              >
                ADD
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        {loading ? (
          <div className="h-16 animate-pulse rounded-lg bg-background/40" />
        ) : rituals.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum ritual ainda. Crie manualmente ou peça sugestões à IA.
          </p>
        ) : (
          rituals.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2"
            >
              <button
                type="button"
                onClick={() => handleToggle(m)}
                aria-label={m.done_today ? "Desmarcar" : "Marcar como feito"}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                  m.done_today
                    ? "border-ember bg-ember text-charcoal-900"
                    : "border-border bg-background"
                }`}
              >
                {m.done_today && <Check className="h-3.5 w-3.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${m.done_today ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {m.title}
                </p>
                {m.scheduled_time && (
                  <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {m.scheduled_time}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleArchive(m)}
                aria-label="Arquivar"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background/50 p-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Novo ritual (ex: orar antes de dormir)"
          maxLength={80}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <input
          value={newTime}
          onChange={(e) => setNewTime(e.target.value)}
          type="time"
          className="w-[70px] bg-transparent text-xs text-foreground focus:outline-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || newTitle.trim().length < 2}
          className="flex items-center gap-1 rounded-md bg-ember px-2 py-1 font-display text-[10px] tracking-[0.2em] text-charcoal-900 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          ADD
        </button>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Integrações com relógios e apps de sono (Samsung Health, Google Fit, Apple Health) chegam em breve — os dados alimentarão a IA para análises comportamentais mais finas.
      </p>
    </div>
  );
}
