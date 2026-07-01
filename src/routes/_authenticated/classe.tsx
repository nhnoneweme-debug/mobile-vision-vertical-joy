import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import {
  checkPerkUnlocks,
  currentTitle,
  listClassPerks,
  listUserPerks,
  playerLevel,
  xpIntoLevel,
  type PerkWithStatus,
} from "@/lib/perks";
import { CLASS_META, type BehavioralClass } from "@/lib/behavior";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/classe")({
  head: () => ({
    meta: [
      { title: "Classe — Personal IA" },
      { name: "description", content: "Sua árvore de evolução e perks por classe." },
    ],
  }),
  component: ClassePage,
});

function ClassePage() {
  const [loading, setLoading] = useState(true);
  const [cls, setCls] = useState<BehavioralClass>("executor");
  const [xp, setXp] = useState(0);
  const [perks, setPerks] = useState<PerkWithStatus[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      try {
        // tenta destravar antes de listar
        const unlocked = await checkPerkUnlocks();
        if (unlocked > 0) {
          toast.success(`+${unlocked} perk${unlocked > 1 ? "s" : ""} destravado${unlocked > 1 ? "s" : ""}!`);
        }
        const { data: prof } = await supabase
          .from("profiles")
          .select("behavioral_class, xp")
          .eq("id", userData.user.id)
          .maybeSingle();
        const klass = (prof?.behavioral_class ?? "executor") as BehavioralClass;
        const all = await listClassPerks(klass);
        const ownedIds = await listUserPerks(userData.user.id);
        if (!active) return;
        setCls(klass);
        setXp(prof?.xp ?? 0);
        setPerks(
          all.map((p) => ({
            ...p,
            unlocked: ownedIds.has(p.id),
            unlocked_at: null,
          })),
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const meta = CLASS_META[cls];
  const level = playerLevel(xp);
  const { into, pct } = xpIntoLevel(xp);
  const unlockedTiers = perks.filter((p) => p.unlocked).map((p) => p.tier);
  const title = currentTitle(cls, unlockedTiers);

  return (
    <MobileShell>
      <header
        className="sticky top-0 z-30 border-b border-border bg-charcoal-900/85 px-4 pb-5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            to="/perfil"
            className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-foreground hover:border-ember/40"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[10px] tracking-[0.3em] text-ember">
              CLASSE · {meta.name.toUpperCase()}
            </p>
            <h1 className="truncate font-display text-2xl leading-none tracking-wide text-foreground">
              {title}
            </h1>
          </div>
          <div className="ember-glow grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-charcoal-900 text-xl">
            {meta.emblem}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-charcoal-900/60 p-3">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[10px] tracking-[0.22em] text-muted-foreground">
              NÍVEL GLOBAL
            </span>
            <span className="font-display text-2xl leading-none tracking-wide text-foreground">
              {level}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-charcoal-800">
            <div className="h-full bg-ember transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 font-display text-[10px] tracking-[0.18em] text-muted-foreground">
            {into} / 500 XP PARA NÍVEL {level + 1}
          </p>
        </div>
      </header>

      <section className="px-4 py-6 pb-32">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Carregando árvore…</p>
        ) : (
          <ol className="relative space-y-3 pl-6">
            <span
              aria-hidden
              className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-ember/40 via-border to-border"
            />
            {perks.map((perk) => (
              <PerkNode key={perk.id} perk={perk} currentLevel={level} />
            ))}
          </ol>
        )}
      </section>

    </MobileShell>
  );
}

function PerkNode({ perk, currentLevel }: { perk: PerkWithStatus; currentLevel: number }) {
  const unlocked = perk.unlocked;
  const reachable = currentLevel >= perk.unlock_level;
  return (
    <li className="relative">
      <span
        aria-hidden
        className={`absolute -left-6 top-4 grid h-6 w-6 place-items-center rounded-full border-2 ${
          unlocked
            ? "border-ember bg-ember text-charcoal-900"
            : reachable
              ? "border-ember/60 bg-charcoal-900 text-ember"
              : "border-border bg-charcoal-900 text-muted-foreground"
        }`}
      >
        {unlocked ? (
          <Sparkles className="h-3 w-3" strokeWidth={2.5} />
        ) : (
          <Lock className="h-3 w-3" strokeWidth={2.5} />
        )}
      </span>
      <div
        className={`rounded-2xl border p-4 transition ${
          unlocked
            ? "border-ember/40 bg-card"
            : "border-border bg-card/60 opacity-70"
        }`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-[10px] tracking-[0.3em] text-ember">
            TIER {perk.tier} · NV {perk.unlock_level}
          </p>
          {unlocked && (
            <span className="font-display text-[9px] tracking-[0.3em] text-ember">
              DESTRAVADO
            </span>
          )}
        </div>
        <h3 className="mt-1 font-display text-xl tracking-wide text-foreground">
          {perk.title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{perk.description}</p>
      </div>
    </li>
  );
}
