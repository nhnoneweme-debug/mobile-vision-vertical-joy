import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, Gem, Infinity as InfinityIcon, Loader2, Sparkles } from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";
import { listAllCrystals, listMyCrystals, rarityClass, type PowerCrystal, type UserCrystal } from "@/lib/crystals";

export const Route = createFileRoute("/_authenticated/cristais")({
  head: () => ({
    meta: [
      { title: "Cristais do Poder — Personal IA" },
      { name: "description", content: "Inventário e efeitos ativos dos seus Cristais do Poder." },
    ],
  }),
  component: CrystalsPage,
});

function CrystalsPage() {
  const [mine, setMine] = useState<UserCrystal[]>([]);
  const [all, setAll] = useState<PowerCrystal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [m, a] = await Promise.all([listMyCrystals(), listAllCrystals()]);
      setMine(m);
      setAll(a);
      setLoading(false);
    })();
  }, []);

  return (
    <MobileShell>
      <section className="border-b border-border px-4 pb-4 pt-6" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
        <p className="font-display text-[10px] tracking-[0.3em] text-ember">JORNADA</p>
        <h1 className="mt-1 font-display text-4xl tracking-wide text-foreground">Cristais do Poder</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Artefatos que ressoam com sua trilha. Cada um pode existir em três camadas: temporal, condicional ou permanente.
        </p>
      </section>

      <div className="space-y-6 px-4 py-5 pb-32">
        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <div>
              <p className="mb-3 font-display text-[11px] tracking-[0.22em] text-muted-foreground">SEU INVENTÁRIO</p>
              {mine.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Você ainda não desbloqueou cristais. Conclua desafios, conquistas ou compre na Forja.
                </p>
              ) : (
                <ul className="space-y-3">
                  {mine.map((uc) => (
                    <li key={uc.id} className={"rounded-2xl border p-4 " + rarityClass(uc.crystal.rarity)}>
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-lg tracking-wide">{uc.crystal.name}</h3>
                        <ModeBadge uc={uc} />
                      </div>
                      <p className="mt-1 text-xs opacity-80">{uc.crystal.description}</p>
                      <p className={"mt-2 text-[11px] " + (uc.is_active_now ? "text-emerald-300" : "text-muted-foreground")}>
                        {uc.is_active_now ? "● Ativo agora" : "○ Inativo"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-3 font-display text-[11px] tracking-[0.22em] text-muted-foreground">CATÁLOGO</p>
              <ul className="space-y-3">
                {all.map((c) => (
                  <li key={c.id} className={"rounded-2xl border p-4 opacity-80 " + rarityClass(c.rarity)}>
                    <div className="flex items-center gap-2">
                      <Gem className="h-4 w-4" />
                      <h3 className="font-display text-base tracking-wide">{c.name}</h3>
                    </div>
                    <p className="mt-1 text-xs opacity-80">{c.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

    </MobileShell>
  );
}

function ModeBadge({ uc }: { uc: UserCrystal }) {
  if (uc.mode === "permanent")
    return (
      <span className="flex items-center gap-1 text-[10px] font-display tracking-[0.2em]">
        <InfinityIcon className="h-3 w-3" /> PERMANENTE
      </span>
    );
  if (uc.mode === "temporal") {
    const left = uc.expires_at ? new Date(uc.expires_at).getTime() - Date.now() : 0;
    const hours = Math.max(0, Math.floor(left / 36e5));
    return (
      <span className="flex items-center gap-1 text-[10px] font-display tracking-[0.2em]">
        <Clock className="h-3 w-3" /> {hours}h
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-display tracking-[0.2em]">
      <Sparkles className="h-3 w-3" /> CONDICIONAL
    </span>
  );
}
