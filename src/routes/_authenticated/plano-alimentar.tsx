import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Utensils, Sparkles, Camera, Clock, Droplet, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/shell/MobileShell";
import { ProfileMenu } from "@/components/shell/ProfileMenu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  clearDietPlan,
  generateDietFromProfile,
  getDietPlan,
  parseDietPlan,
  type DietPlan,
} from "@/lib/cozinha.functions";

export const Route = createFileRoute("/_authenticated/plano-alimentar")({
  head: () => ({ meta: [{ title: "Plano Alimentar — Personal IA" }] }),
  component: PlanoPage,
});

const TOUR_KEY = "pa_tour_seen_v1";

function PlanoPage() {
  const fnGet = useServerFn(getDietPlan);
  const fnGenerate = useServerFn(generateDietFromProfile);
  const fnParse = useServerFn(parseDietPlan);
  const fnClear = useServerFn(clearDietPlan);

  const [displayName, setDisplayName] = useState("Você");
  const [plan, setPlan] = useState<DietPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [showTour, setShowTour] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) setShowTour(true);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", data.user.id)
          .maybeSingle();
        if (profile?.display_name) setDisplayName(profile.display_name);
      }
      try {
        const p = await fnGet();
        setPlan(p);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [fnGet]);

  function finishTour() {
    localStorage.setItem(TOUR_KEY, "1");
    setShowTour(false);
  }

  async function handleGenerate() {
    setBusy(true);
    try {
      const p = await fnGenerate();
      setPlan(p);
      toast.success("Dieta montada pela IA.");
      finishTour();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui montar a dieta agora.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveText() {
    if (editText.trim().length < 5) return;
    setBusy(true);
    try {
      const p = await fnParse({ data: { raw_text: editText } });
      setPlan(p);
      setEditOpen(false);
      toast.success("Dieta organizada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao organizar a dieta.");
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    try {
      await fnClear();
      setPlan(null);
      toast("Dieta removida.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileShell>
      <header
        className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-charcoal-900/85 pb-3 pl-14 pr-4 pt-5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <span className="ember-glow grid h-10 w-10 place-items-center rounded-2xl bg-charcoal-800 text-ember">
          <Utensils className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl leading-none tracking-wide text-foreground">
            PLANO ALIMENTAR
          </h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Sua dieta, montada e ajustada pela IA
          </p>
        </div>
        <ProfileMenu displayName={displayName} />
      </header>

      <section className="px-4 pt-4">
        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-charcoal-900/50" />
        ) : !plan ? (
          <div className="forge-card rounded-2xl p-4 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-charcoal-800 text-ember">
              <Utensils className="h-6 w-6" />
            </span>
            <p className="mt-3 font-display text-base tracking-wide text-foreground">
              Você ainda não tem uma dieta
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              A IA monta um plano do zero com base no seu objetivo do onboarding, ou você pode colar
              uma dieta que já tem.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={busy}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-ember px-3 py-2.5 font-display text-[11px] tracking-[0.2em] text-charcoal-900 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {busy ? "MONTANDO…" : "MONTAR COM A IA"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditText("");
                  setEditOpen(true);
                }}
                className="rounded-lg border border-border px-3 py-2.5 font-display text-[11px] tracking-[0.2em] text-muted-foreground"
              >
                COLAR MINHA DIETA
              </button>
            </div>
          </div>
        ) : (
          <div className="forge-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <p className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">
                {plan.source_text.startsWith("Gerado pela IA") ? "MONTADA PELA IA" : "SUA DIETA"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditText(plan.source_text);
                  setEditOpen(true);
                }}
                className="font-display text-[10px] tracking-[0.2em] text-muted-foreground hover:text-foreground"
              >
                EDITAR
              </button>
            </div>

            {plan.hydration_ml ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-charcoal-900/50 px-3 py-2">
                <Droplet className="h-3.5 w-3.5 text-ember" />
                <p className="text-xs text-foreground">
                  Meta de hidratação:{" "}
                  <span className="font-semibold">{plan.hydration_ml} ml/dia</span>
                </p>
              </div>
            ) : null}

            {plan.warnings && plan.warnings.length > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-2.5 text-xs text-yellow-200/90">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  {plan.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              </div>
            )}

            <p className="mb-2 mt-4 font-display text-[10px] tracking-[0.25em] text-muted-foreground">
              REFEIÇÕES DE HOJE
            </p>
            <ul className="space-y-2">
              {plan.meals.map((m, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-border bg-charcoal-900/50 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-charcoal-800 text-ember">
                      <Clock className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block font-display text-sm tracking-wide text-foreground">
                        {m.time} · {m.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {m.items.join(", ")}
                      </span>
                    </div>
                  </div>
                  {m.notes ? (
                    <p className="ml-10 mt-1 text-[11px] italic text-muted-foreground">{m.notes}</p>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={busy}
                className="flex items-center gap-1.5 font-display text-[10px] tracking-[0.2em] text-ember disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" /> GERAR NOVA COM IA
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={busy}
                className="flex items-center gap-1.5 font-display text-[10px] tracking-[0.2em] text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> LIMPAR
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Registro por foto/código de barras — ainda não conectado a uma IA de visão real */}
      <section className="px-4 pt-4">
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-charcoal-900/30 p-4 opacity-70">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-charcoal-800 text-muted-foreground">
            <Camera className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-[11px] tracking-[0.2em] text-muted-foreground">
              REGISTRO POR FOTO / CÓDIGO DE BARRAS
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Em breve — ainda não temos uma IA de visão conectada para calcular calorias por foto.
            </p>
          </div>
        </div>
      </section>

      <div className="h-28" />

      {/* Tour de primeiro acesso */}
      <Sheet open={showTour} onOpenChange={(o) => !o && finishTour()}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-[var(--shell-max)] rounded-t-2xl border-border bg-charcoal-900/95 backdrop-blur-xl"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 font-display tracking-[0.18em] text-foreground">
              <Sparkles className="h-4 w-4 text-ember" /> BEM-VINDO AO PLANO ALIMENTAR
            </SheetTitle>
          </SheetHeader>
          <div className="mt-3 space-y-3 text-sm text-foreground/90">
            <p>
              Aqui a IA monta sua dieta com base no seu objetivo do onboarding, ou você pode colar
              uma dieta que já segue e ela organiza em refeições com horário.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={finishTour}
                className="flex-1 rounded-lg border border-border px-3 py-2.5 font-display text-[11px] tracking-[0.2em] text-muted-foreground"
              >
                AGORA NÃO
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ember px-3 py-2.5 font-display text-[11px] tracking-[0.2em] text-charcoal-900 disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {busy ? "MONTANDO…" : "MONTAR COM A IA"}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Colar/editar dieta em texto — organizada pela IA (parseDietPlan real) */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-[var(--shell-max)] rounded-t-2xl border-border bg-charcoal-900/95 backdrop-blur-xl"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 font-display tracking-[0.18em] text-foreground">
              <Utensils className="h-4 w-4 text-ember" /> SUA DIETA EM TEXTO
            </SheetTitle>
          </SheetHeader>
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Cole sua dieta como ela vier — texto bagunçado tudo bem. A IA organiza em refeições
              com horário.
            </p>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={6}
              maxLength={4000}
              placeholder="Ex: café 7h ovos mexidos com pão integral. 10h fruta. almoço 12h30 arroz, feijão, frango grelhado, salada. jantar 20h…"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ember focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveText}
              disabled={editText.trim().length < 5 || busy}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-ember px-3 py-2.5 font-display text-[11px] tracking-[0.2em] text-charcoal-900 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {busy ? "ORGANIZANDO…" : "ORGANIZAR COM A IA"}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </MobileShell>
  );
}
