import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Utensils,
  Sparkles,
  Camera,
  ScanLine,
  Clock,
  Salad,
  History as HistoryIcon,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/shell/MobileShell";
import { ProfileMenu } from "@/components/shell/ProfileMenu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/plano-alimentar")({
  head: () => ({ meta: [{ title: "Plano Alimentar — Personal IA" }] }),
  component: PlanoPage,
});

// ---------------------------------------------------------------------------
// Dados simulados — a tela ainda não está ligada ao backend real de dieta.
// Layout e interações seguem o wireframe "TELAS DA ABA DE PLANO ALIMENTAR".
// ---------------------------------------------------------------------------

const TOUR_KEY = "pa_tour_seen_v1";
const DAILY_GOAL = 2200;

type FoodEntry = { id: string; time: string; name: string; qty: string; kcal: number };

const MOCK_HISTORY_TODAY: FoodEntry[] = [
  { id: "h1", time: "07:32", name: "Ovos mexidos + aveia", qty: "2 ovos, 40g aveia", kcal: 320 },
  { id: "h2", time: "10:15", name: "Banana", qty: "1 unidade", kcal: 90 },
  {
    id: "h3",
    time: "12:40",
    name: "Arroz, feijão, frango grelhado",
    qty: "1 prato médio",
    kcal: 610,
  },
  { id: "h4", time: "16:05", name: "Iogurte natural", qty: "1 pote", kcal: 110 },
];

const MOCK_RECOMMENDED = [
  { id: "r1", name: "Peito de frango grelhado", kcal: 250 },
  { id: "r2", name: "Salada de folhas + azeite", kcal: 90 },
  { id: "r3", name: "Castanhas (porção)", kcal: 180 },
];

const GOAL_TIPS: Record<string, string[]> = {
  emagrecimento: [
    "Priorize proteína magra nas próximas refeições — ajuda a manter a saciedade.",
    "Beba um copo de água antes das refeições para controlar a fome.",
  ],
  hipertrofia: [
    "Você ainda está abaixo da meta de proteína hoje — inclua uma fonte extra no jantar.",
    "Não pule refeições: seu objetivo exige consistência calórica ao longo do dia.",
  ],
  default: [
    "Distribua as calorias em refeições menores ao longo do dia.",
    "Inclua vegetais em pelo menos duas refeições hoje.",
  ],
};

const WEEK_DATA = [1850, 2100, 1980, 2200, 1750, 2050, 1900];
const MONTH_DATA = [1900, 1950, 2000, 1880, 2100, 1990, 2050, 1870, 1930, 2010, 2080, 1950];

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const size = 200;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, consumed / goal));
  const consumedLen = c * pct;
  const remainingLen = c - consumedLen;

  return (
    <div className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--charcoal-800)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="oklch(0.72 0.19 155)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${consumedLen} ${c}`}
          style={{ transition: "stroke-dasharray 800ms ease" }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="oklch(0.72 0.17 15)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${remainingLen} ${c}`}
          strokeDashoffset={-consumedLen}
          style={{ transition: "stroke-dasharray 800ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[9px] tracking-[0.25em] text-muted-foreground">
          CONSUMIDAS HOJE
        </span>
        <span className="font-display text-4xl leading-none text-foreground">{consumed}</span>
        <span className="mt-1 font-display text-[10px] tracking-[0.2em] text-muted-foreground">
          META DIÁRIA {goal}
        </span>
      </div>
    </div>
  );
}

function RangeChart({ data }: { data: number[] }) {
  const w = 320;
  const h = 90;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(1, max - min);
  const step = w / (data.length - 1);
  const path = data
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * (h - 12) - 6;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const lastX = (data.length - 1) * step;
  const lastY = h - ((data[data.length - 1] - min) / range) * (h - 12) - 6;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <path
        d={path}
        fill="none"
        stroke="var(--ember)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={4} fill="var(--ember)" />
    </svg>
  );
}

function PlanoPage() {
  const [displayName, setDisplayName] = useState("Você");
  const [goal, setGoal] = useState<string | null>(null);

  const [showTour, setShowTour] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const [range, setRange] = useState<"SEM" | "MEN">("SEM");

  const [logOpen, setLogOpen] = useState(false);
  const [logStep, setLogStep] = useState<"input" | "calculating" | "confirm">("input");
  const [logPhotoName, setLogPhotoName] = useState<string | null>(null);
  const [logQty, setLogQty] = useState("");
  const [logBarcode, setLogBarcode] = useState("");
  const [logResult, setLogResult] = useState<{ name: string; kcal: number } | null>(null);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) setShowTour(true);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, goal")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile?.display_name) setDisplayName(profile.display_name);
      if (profile?.goal) setGoal(profile.goal);
    })();
  }, []);

  const consumedToday = useMemo(() => MOCK_HISTORY_TODAY.reduce((s, e) => s + e.kcal, 0), []);

  const tips = GOAL_TIPS[goal ?? ""] ?? GOAL_TIPS.default;
  const dayTip = tips[new Date().getDate() % tips.length];

  function finishTour() {
    localStorage.setItem(TOUR_KEY, "1");
    setShowTour(false);
  }

  async function handleGenerateWithAI() {
    setGeneratingPlan(true);
    await new Promise((r) => setTimeout(r, 1400));
    setGeneratingPlan(false);
    toast.success(
      "Dieta gerada com base no seu perfil (simulado — IA real entra na próxima etapa).",
    );
    finishTour();
  }

  function openLog() {
    setLogOpen(true);
    setLogStep("input");
    setLogPhotoName(null);
    setLogQty("");
    setLogBarcode("");
    setLogResult(null);
  }

  async function handleCalculate() {
    setLogStep("calculating");
    await new Promise((r) => setTimeout(r, 1200));
    setLogResult({
      name: logPhotoName
        ? "Alimento da foto"
        : logBarcode
          ? "Alimento do código de barras"
          : "Alimento informado",
      kcal: Math.round(180 + Math.random() * 380),
    });
    setLogStep("confirm");
  }

  function handleConfirmLog() {
    toast.success(`Registrado: ${logResult?.name} · ${logResult?.kcal} kcal (simulado)`);
    setLogOpen(false);
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
            Sua dieta, calorias e histórico do dia
          </p>
        </div>
        <ProfileMenu displayName={displayName} />
      </header>

      {/* Anel de calorias + alimentos consumidos hoje */}
      <section className="px-4 pt-4">
        <div className="forge-card rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <CalorieRing consumed={consumedToday} goal={DAILY_GOAL} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">
                CALORIAS CONSUMIDAS / META
              </p>
              <p className="font-display text-lg text-foreground">
                {consumedToday}
                <span className="text-sm text-muted-foreground"> / {DAILY_GOAL} kcal</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Meta mensal de referência:{" "}
                <span className="text-foreground">{DAILY_GOAL * 30} kcal</span>
              </p>
              <div className="flex items-center gap-3 pt-1">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: "oklch(0.72 0.19 155)" }}
                  />{" "}
                  consumido
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: "oklch(0.72 0.17 15)" }}
                  />{" "}
                  restante
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 font-display text-[10px] tracking-[0.25em] text-muted-foreground">
              ALIMENTOS CONSUMIDOS HOJE
            </p>
            <div className="space-y-1.5">
              {MOCK_HISTORY_TODAY.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{f.name}</span>
                  <span className="text-muted-foreground">{f.kcal} kcal</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Dica dinâmica do dia, de acordo com o objetivo */}
      <section className="px-4 pt-3">
        <div className="flex items-start gap-2.5 rounded-2xl border border-ember/30 bg-ember/5 p-3.5">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
          <div>
            <p className="font-display text-[10px] tracking-[0.25em] text-ember">DICA DE HOJE</p>
            <p className="mt-0.5 text-xs text-foreground/90">{dayTip}</p>
          </div>
        </div>
      </section>

      {/* Gráfico de progressão semanal/mensal */}
      <section className="px-4 pt-4">
        <div className="forge-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">
              PROGRESSÃO
            </p>
            <div className="flex rounded-lg border border-border p-0.5">
              {(["SEM", "MEN"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={
                    "rounded-md px-2.5 py-1 font-display text-[10px] tracking-[0.2em] " +
                    (range === r ? "bg-ember text-charcoal-900" : "text-muted-foreground")
                  }
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <RangeChart data={range === "SEM" ? WEEK_DATA : MONTH_DATA} />
          </div>
        </div>
      </section>

      {/* Recomendados + histórico */}
      <section className="px-4 pt-4">
        <div className="forge-card rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <Salad className="h-4 w-4 text-ember" />
            <p className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">
              ALIMENTOS RECOMENDADOS PARA HOJE
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {MOCK_RECOMMENDED.map((r) => (
              <span
                key={r.id}
                className="rounded-full border border-border bg-charcoal-900/60 px-3 py-1.5 text-[11px] text-foreground"
              >
                {r.name} · {r.kcal} kcal
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
            <HistoryIcon className="h-4 w-4 text-ember" />
            <p className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">
              HISTÓRICO DE ALIMENTOS DE HOJE
            </p>
          </div>
          <div className="mt-2 space-y-2">
            {MOCK_HISTORY_TODAY.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-charcoal-900/50 px-3 py-2.5"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-charcoal-800 text-ember">
                  <Clock className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-sm tracking-wide text-foreground">
                    {f.name}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {f.time} · {f.qty}
                  </span>
                </span>
                <span className="shrink-0 font-display text-xs text-ember">{f.kcal} kcal</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAB — registrar alimento por foto/código de barras via IA */}
      <button
        type="button"
        onClick={openLog}
        aria-label="Registrar alimento com a IA"
        className="fixed bottom-24 left-1/2 z-40 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full border border-ember/40 bg-charcoal-900 text-ember forge-raised active:scale-95"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <Camera className="h-6 w-6" strokeWidth={2.2} />
      </button>

      <div className="h-28" />

      {/* Tour de primeiro acesso + criação de dieta com IA */}
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
              Aqui você acompanha suas calorias do dia, vê sua progressão semanal/mensal e registra
              o que come.
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-xs text-muted-foreground">
              <li>O anel mostra o quanto você já consumiu perto da sua meta.</li>
              <li>
                Toque no botão de câmera para registrar um alimento por foto ou código de barras — a
                IA calcula e pede sua confirmação.
              </li>
              <li>Cards de dicas mudam de acordo com o seu objetivo.</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Quer que a IA monte sua dieta agora, usando os dados do seu onboarding e seu objetivo?
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
                onClick={handleGenerateWithAI}
                disabled={generatingPlan}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ember px-3 py-2.5 font-display text-[11px] tracking-[0.2em] text-charcoal-900 disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {generatingPlan ? "MONTANDO…" : "MONTAR COM A IA"}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Registrar alimento — foto / código de barras, cálculo e confirmação */}
      <Sheet open={logOpen} onOpenChange={setLogOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-[var(--shell-max)] rounded-t-2xl border-border bg-charcoal-900/95 backdrop-blur-xl"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 font-display tracking-[0.18em] text-foreground">
              <Camera className="h-4 w-4 text-ember" /> REGISTRAR ALIMENTO
            </SheetTitle>
          </SheetHeader>

          {logStep === "input" && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Envie a foto do prato e a quantidade, ou o código de barras — a IA calcula as
                calorias e pede para você confirmar.
              </p>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-charcoal-800/40 px-4 py-6 text-center">
                <Camera className="h-6 w-6 text-ember" />
                <span className="text-xs text-muted-foreground">
                  {logPhotoName ?? "Toque para enviar uma foto do alimento"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => setLogPhotoName(e.target.files?.[0]?.name ?? null)}
                />
              </label>
              <Input
                placeholder="Quantidade (ex.: 1 prato médio, 200g)"
                value={logQty}
                onChange={(e) => setLogQty(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[10px] text-muted-foreground">OU</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <ScanLine className="h-4 w-4 text-ember" />
                <input
                  placeholder="Código de barras"
                  value={logBarcode}
                  onChange={(e) => setLogBarcode(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleCalculate}
                disabled={!logPhotoName && !logQty && !logBarcode}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-ember px-3 py-2.5 font-display text-[11px] tracking-[0.2em] text-charcoal-900 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" /> CALCULAR COM A IA
              </button>
            </div>
          )}

          {logStep === "calculating" && (
            <div className="mt-6 flex flex-col items-center gap-3 pb-6">
              <span className="ember-glow grid h-12 w-12 animate-pulse place-items-center rounded-2xl bg-charcoal-800 text-ember">
                <Sparkles className="h-6 w-6" />
              </span>
              <p className="font-display text-xs tracking-[0.2em] text-muted-foreground">
                A IA ESTÁ CALCULANDO…
              </p>
            </div>
          )}

          {logStep === "confirm" && logResult && (
            <div className="mt-3 space-y-3 pb-2">
              <div className="rounded-xl border border-ember/30 bg-ember/5 p-3.5">
                <p className="font-display text-[10px] tracking-[0.25em] text-ember">
                  RESULTADO ESTIMADO
                </p>
                <p className="mt-1 font-display text-lg text-foreground">{logResult.name}</p>
                <p className="text-sm text-muted-foreground">{logResult.kcal} kcal</p>
              </div>
              <p className="text-xs text-muted-foreground">Confirma esse registro?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLogStep("input")}
                  className="flex-1 rounded-lg border border-border px-3 py-2.5 font-display text-[11px] tracking-[0.2em] text-muted-foreground"
                >
                  EDITAR
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLog}
                  className="flex-1 rounded-lg bg-ember px-3 py-2.5 font-display text-[11px] tracking-[0.2em] text-charcoal-900"
                >
                  CONFIRMAR
                </button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </MobileShell>
  );
}
