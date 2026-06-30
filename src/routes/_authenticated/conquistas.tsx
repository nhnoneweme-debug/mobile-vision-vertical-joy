import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Award, BookOpen, Lock, Check, Flame, Sparkles, Crown, Calendar, Sprout, Sunrise, Compass, Users, ShoppingBag, TowerControl } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import {
  listAchievements,
  listUserAchievements,
  listLoreChapters,
  listReadChapters,
  markChapterRead,
  checkAchievements,
  markAchievementsSeen,
  RARITY_STYLES,
  type Achievement,
  type UserAchievement,
  type LoreChapter,
} from "@/lib/achievements";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/conquistas")({
  head: () => ({
    meta: [
      { title: "Conquistas — Personal IA" },
      { name: "description", content: "Suas conquistas e a lore do Oráculo das Brasas." },
    ],
  }),
  component: ConquistasPage,
});

const ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  flame: Flame, sparkles: Sparkles, crown: Crown, calendar: Calendar,
  sprout: Sprout, sunrise: Sunrise, compass: Compass, users: Users,
  "shopping-bag": ShoppingBag, "tower-control": TowerControl, award: Award,
};

type Tab = "achievements" | "lore";

function ConquistasPage() {
  const [tab, setTab] = useState<Tab>("achievements");
  const [userId, setUserId] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlocked, setUnlocked] = useState<UserAchievement[]>([]);
  const [chapters, setChapters] = useState<LoreChapter[]>([]);
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const [playerLevel, setPlayerLevel] = useState(1);
  const [openChapter, setOpenChapter] = useState<LoreChapter | null>(null);

  async function refresh(uid: string) {
    const [all, mine, lore, read, prof] = await Promise.all([
      listAchievements(),
      listUserAchievements(uid),
      listLoreChapters(),
      listReadChapters(uid),
      supabase.from("profiles").select("xp").eq("id", uid).maybeSingle(),
    ]);
    setAchievements(all);
    setUnlocked(mine);
    setChapters(lore);
    setReadSet(read);
    const xp = (prof.data?.xp as number | undefined) ?? 0;
    setPlayerLevel(Math.max(1, Math.floor(xp / 500) + 1));
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || !active) return;
      setUserId(data.user.id);
      // verifica conquistas pendentes ao abrir
      try {
        const newly = await checkAchievements();
        if (newly.length > 0) {
          toast.success(`${newly.length} nova(s) conquista(s) desbloqueada(s)!`);
        }
      } catch {
        /* silent */
      }
      await refresh(data.user.id);
      // marca todas como vistas
      const mine = await listUserAchievements(data.user.id);
      const unseen = mine.filter((m) => !m.seen).map((m) => m.achievement_id);
      if (unseen.length > 0) await markAchievementsSeen(data.user.id, unseen);
    })();
    return () => { active = false; };
  }, []);

  const unlockedMap = useMemo(() => {
    const m = new Map<string, UserAchievement>();
    unlocked.forEach((u) => m.set(u.achievement_id, u));
    return m;
  }, [unlocked]);

  const stats = useMemo(() => {
    const total = achievements.length;
    const got = unlocked.length;
    return { total, got, pct: total > 0 ? Math.round((got / total) * 100) : 0 };
  }, [achievements, unlocked]);

  async function handleReadChapter(ch: LoreChapter) {
    setOpenChapter(ch);
    if (!userId || readSet.has(ch.id)) return;
    try {
      await markChapterRead(userId, ch.id);
      setReadSet((s) => new Set(s).add(ch.id));
    } catch {
      /* silent */
    }
  }

  return (
    <MobileShell>
      <header
        className="border-b border-border px-4 pb-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <Link to="/mapa" className="inline-flex items-center gap-1 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          <span className="font-display text-[10px] tracking-[0.3em]">MAPA</span>
        </Link>
        <h1 className="mt-2 font-display text-3xl tracking-wide text-foreground">
          Conquistas & Saga
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {stats.got}/{stats.total} conquistas · {stats.pct}% da jornada
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTab("achievements")}
            className={`rounded-xl border px-3 py-2 font-display text-[11px] tracking-[0.25em] ${
              tab === "achievements"
                ? "border-ember bg-ember/10 text-ember"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            <Award className="mr-1 inline h-4 w-4" /> CONQUISTAS
          </button>
          <button
            type="button"
            onClick={() => setTab("lore")}
            className={`rounded-xl border px-3 py-2 font-display text-[11px] tracking-[0.25em] ${
              tab === "lore"
                ? "border-ember bg-ember/10 text-ember"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            <BookOpen className="mr-1 inline h-4 w-4" /> SAGA
          </button>
        </div>
      </header>

      <section className="px-4 py-5">
        {tab === "achievements" && (
          <ul className="space-y-3">
            {achievements.map((a) => {
              const got = unlockedMap.has(a.id);
              const style = RARITY_STYLES[a.rarity];
              const Icon = ICONS[a.icon] ?? Award;
              return (
                <li
                  key={a.id}
                  className={`rounded-2xl border p-4 ${
                    got ? `${style.bg} border-transparent ring-1 ${style.ring}` : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${got ? "bg-charcoal-900" : "bg-charcoal-900/60"}`}>
                      {got ? (
                        <Icon className={`h-6 w-6 ${style.text}`} strokeWidth={2.2} />
                      ) : (
                        <Lock className="h-5 w-5 text-muted-foreground" strokeWidth={2.2} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`font-display text-[10px] tracking-[0.3em] ${got ? style.text : "text-muted-foreground"}`}>
                          {style.label}
                        </p>
                        {got && <Check className="h-3 w-3 text-ember" />}
                      </div>
                      <p className={`mt-1 font-display text-base leading-tight tracking-wide ${got ? "text-foreground" : "text-muted-foreground"}`}>
                        {a.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
                      {got && a.lore_fragment && (
                        <p className="mt-2 border-l-2 border-ember/40 pl-3 text-xs italic text-foreground/80">
                          "{a.lore_fragment}"
                        </p>
                      )}
                      <div className="mt-2 flex gap-3 font-display text-[10px] tracking-[0.25em] text-muted-foreground">
                        {a.xp_reward > 0 && <span>+{a.xp_reward} XP</span>}
                        {a.brasas_reward > 0 && <span>+{a.brasas_reward} BRASAS</span>}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "lore" && (
          <ul className="space-y-3">
            {chapters.map((ch) => {
              const locked = playerLevel < ch.unlock_level;
              const wasRead = readSet.has(ch.id);
              return (
                <li key={ch.id}>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => handleReadChapter(ch)}
                    className={`w-full rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                      locked
                        ? "border-border bg-card opacity-60"
                        : wasRead
                          ? "border-border bg-card"
                          : "border-ember/40 bg-ember/5"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-charcoal-900">
                        {locked ? (
                          <Lock className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <BookOpen className={`h-5 w-5 ${wasRead ? "text-muted-foreground" : "text-ember"}`} strokeWidth={2.2} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-[10px] tracking-[0.3em] text-ember">
                          CAPÍTULO {String(ch.chapter_number).padStart(2, "0")}
                        </p>
                        <p className="mt-1 font-display text-lg leading-tight tracking-wide text-foreground">
                          {ch.title}
                        </p>
                        {ch.subtitle && (
                          <p className="mt-1 text-xs italic text-muted-foreground">{ch.subtitle}</p>
                        )}
                        <p className="mt-2 font-display text-[10px] tracking-[0.25em] text-muted-foreground">
                          {locked ? `DESBLOQUEIA NO NÍVEL ${ch.unlock_level}` : wasRead ? "LIDO" : "NOVO · TOQUE PARA LER"}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {openChapter && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm"
          onClick={() => setOpenChapter(null)}
        >
          <div
            className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border-t border-ember/30 bg-charcoal-900 px-5 pb-12 pt-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-border" />
            <p className="font-display text-[10px] tracking-[0.3em] text-ember">
              CAPÍTULO {String(openChapter.chapter_number).padStart(2, "0")}
            </p>
            <h2 className="mt-1 font-display text-3xl tracking-wide text-foreground">
              {openChapter.title}
            </h2>
            {openChapter.subtitle && (
              <p className="mt-1 text-sm italic text-muted-foreground">{openChapter.subtitle}</p>
            )}
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {openChapter.body}
            </div>
            <button
              type="button"
              onClick={() => setOpenChapter(null)}
              className="mt-6 w-full rounded-xl border border-ember/40 bg-card py-3 font-display text-xs tracking-[0.3em] text-ember"
            >
              FECHAR
            </button>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
