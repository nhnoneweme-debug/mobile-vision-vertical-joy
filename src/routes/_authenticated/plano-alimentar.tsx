import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Utensils,
  Sparkles,
  Camera,
  ScanLine,
  PenLine,
  Clock,
  Droplet,
  Trash2,
  AlertTriangle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/shell/MobileShell";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { DietEditor, type DietDraft } from "@/components/area/DietEditor";
import { BarcodeScanner } from "@/components/plano/BarcodeScanner";
import {
  clearDietPlan,
  generateDietFromProfile,
  getDietPlan,
  parseDietPlan,
  saveDietPlan,
  type DietPlan,
} from "@/lib/cozinha.functions";
import {
  confirmFoodLog,
  deleteFoodLogEntry,
  getFoodLogHistory,
  getTodayFoodLog,
  logFoodFromBarcode,
  logFoodFromPhoto,
  logFoodFromText,
  type FoodLogEntry,
  type FoodProposal,
} from "@/lib/food-log.functions";

export const Route = createFileRoute("/_authenticated/plano-alimentar")({
  head: () => ({ meta: [{ title: "Plano Alimentar — Personal IA" }] }),
  component: PlanoPage,
});

const TOUR_KEY = "pa_tour_seen_v2";

async function resizeImageFile(
  file: File,
  maxDim = 1024,
  quality = 0.72,
): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = dataUrl.split(",")[1] ?? "";
  return { base64, mediaType: "image/jpeg" };
}

function CalorieRing({ consumed, goal }: { consumed: number; goal: number | null }) {
  const size = 190;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  if (!goal) {
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
            stroke="var(--ember)"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${Math.min(c, (consumed / 3000) * c)} ${c}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[9px] tracking-[0.25em] text-muted-foreground">
            CONSUMIDAS HOJE
          </span>
          <span className="font-display text-4xl leading-none text-foreground">{consumed}</span>
          <span className="mt-1 font-display text-[9px] tracking-[0.2em] text-muted-foreground">
            SEM META DEFINIDA
          </span>
        </div>
      </div>
    );
  }

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
          META {goal}
        </span>
      </div>
    </div>
  );
}

function RangeChart({ data }: { data: number[] }) {
  const w = 320;
  const h = 90;
  const max = Math.max(1, ...data);
  const step = w / Math.max(1, data.length - 1);
  const path = data
    .map((v, i) => {
      const x = i * step;
      const y = h - (v / max) * (h - 12) - 6;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const lastX = (data.length - 1) * step;
  const lastY = h - (data[data.length - 1] / max) * (h - 12) - 6;
  const allZero = data.every((v) => v === 0);

  if (allZero) {
    return (
      <div className="flex h-[90px] items-center justify-center rounded-xl border border-dashed border-border">
        <span className="font-display text-[10px] tracking-[0.2em] text-muted-foreground">
          AINDA SEM REGISTROS
        </span>
      </div>
    );
  }

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

type LogTab = "foto" | "barcode" | "manual";
type LogStep = "input" | "calculating" | "confirm";

function PlanoPage() {
  const fnGet = useServerFn(getDietPlan);
  const fnGenerate = useServerFn(generateDietFromProfile);
  const fnParse = useServerFn(parseDietPlan);
  const fnClear = useServerFn(clearDietPlan);
  const fnToday = useServerFn(getTodayFoodLog);
  const fnHistory = useServerFn(getFoodLogHistory);
  const fnLogPhoto = useServerFn(logFoodFromPhoto);
  const fnLogBarcode = useServerFn(logFoodFromBarcode);
  const fnLogText = useServerFn(logFoodFromText);
  const fnConfirmLog = useServerFn(confirmFoodLog);
  const fnDeleteLog = useServerFn(deleteFoodLogEntry);
  const fnSaveDiet = useServerFn(saveDietPlan);

  const [plan, setPlan] = useState<DietPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [todayEntries, setTodayEntries] = useState<FoodLogEntry[]>([]);
  const [todayKcal, setTodayKcal] = useState(0);
  const [range, setRange] = useState<"SEM" | "MEN">("SEM");
  const [weekData, setWeekData] = useState<number[]>([]);
  const [monthData, setMonthData] = useState<number[]>([]);

  const [showTour, setShowTour] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");

  // Editor estruturado (edição direta refeição a refeição)
  const [structOpen, setStructOpen] = useState(false);
  const [draft, setDraft] = useState<DietDraft>({
    meals: [],
    hydration_ml: null,
    daily_kcal_target: null,
  });

  const [logOpen, setLogOpen] = useState(false);
  const [logTab, setLogTab] = useState<LogTab>("foto");
  const [logStep, setLogStep] = useState<LogStep>("input");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoHint, setPhotoHint] = useState("");
  const [barcodeValue, setBarcodeValue] = useState("");
  const [barcodeGrams, setBarcodeGrams] = useState("100");
  const [scanOpen, setScanOpen] = useState(false);
  const [manualText, setManualText] = useState("");
  const [proposal, setProposal] = useState<FoodProposal | null>(null);

  const loadToday = useCallback(async () => {
    try {
      const r = await fnToday();
      setTodayEntries(r.entries);
      setTodayKcal(r.totalKcal);
    } catch (e) {
      console.error(e);
    }
  }, [fnToday]);

  const loadHistory = useCallback(async () => {
    try {
      const [week, month] = await Promise.all([
        fnHistory({ data: { days: 7 } }),
        fnHistory({ data: { days: 30 } }),
      ]);
      setWeekData(week.map((d) => d.kcal));
      setMonthData(month.map((d) => d.kcal));
    } catch (e) {
      console.error(e);
    }
  }, [fnHistory]);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) setShowTour(true);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const p = await fnGet();
        setPlan(p);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
      await Promise.all([loadToday(), loadHistory()]);
    })();
  }, [fnGet, loadToday, loadHistory]);

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

  function openStructEditor() {
    setDraft({
      meals: (plan?.meals ?? []).map((m) => ({ time: m.time, name: m.name, items: [...m.items] })),
      hydration_ml: plan?.hydration_ml ?? null,
      daily_kcal_target: plan?.daily_kcal_target ?? null,
    });
    setStructOpen(true);
  }

  async function handleSaveStruct() {
    if (draft.meals.length === 0) {
      toast.error("Adicione ao menos uma refeição.");
      return;
    }
    setBusy(true);
    try {
      await fnSaveDiet({
        data: {
          name: plan?.source_text,
          hydration_ml: draft.hydration_ml,
          daily_kcal_target: draft.daily_kcal_target,
          meals: draft.meals.map((m) => ({ time: m.time, name: m.name, items: m.items })),
        },
      });
      const p = await fnGet();
      setPlan(p);
      setStructOpen(false);
      toast.success("Plano atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  // Código de barras lido pela câmera → consulta direta (evita estado obsoleto).
  async function handleScanned(code: string) {
    setScanOpen(false);
    setBarcodeValue(code);
    setLogTab("barcode");
    setLogStep("calculating");
    try {
      const p = await fnLogBarcode({
        data: { barcode: code, quantity_grams: Number(barcodeGrams) || 100 },
      });
      setProposal(p);
      setLogStep("confirm");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Produto não encontrado.");
      setLogStep("input");
    }
  }

  function openLog() {
    setLogOpen(true);
    setLogTab("foto");
    setLogStep("input");
    setPhotoFile(null);
    setPhotoHint("");
    setBarcodeValue("");
    setBarcodeGrams("100");
    setManualText("");
    setProposal(null);
  }

  async function handleCalculate() {
    setLogStep("calculating");
    try {
      let p: FoodProposal;
      if (logTab === "foto") {
        if (!photoFile) {
          setLogStep("input");
          return;
        }
        const { base64, mediaType } = await resizeImageFile(photoFile);
        p = await fnLogPhoto({
          data: {
            image_base64: base64,
            media_type: mediaType,
            quantity_hint: photoHint || undefined,
          },
        });
      } else if (logTab === "barcode") {
        p = await fnLogBarcode({
          data: { barcode: barcodeValue.trim(), quantity_grams: Number(barcodeGrams) || 100 },
        });
      } else {
        p = await fnLogText({ data: { description: manualText.trim() } });
      }
      setProposal(p);
      setLogStep("confirm");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui calcular agora.");
      setLogStep("input");
    }
  }

  async function handleConfirmLog() {
    if (!proposal) return;
    setBusy(true);
    try {
      await fnConfirmLog({ data: proposal });
      toast.success(`Registrado: ${proposal.name} · ${proposal.kcal} kcal`);
      setLogOpen(false);
      await Promise.all([loadToday(), loadHistory()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteEntry(id: string) {
    try {
      await fnDeleteLog({ data: { id } });
      await Promise.all([loadToday(), loadHistory()]);
      toast("Removido do diário.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover.");
    }
  }

  const dailyGoal = plan?.daily_kcal_target ?? null;
  const canCalculate =
    (logTab === "foto" && !!photoFile) ||
    (logTab === "barcode" && barcodeValue.trim().length >= 6) ||
    (logTab === "manual" && manualText.trim().length >= 3);

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
      </header>

      {/* Anel de calorias — dado real do diário */}
      <section className="px-4 pt-4">
        <div className="forge-card rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <CalorieRing consumed={todayKcal} goal={dailyGoal} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">
                CALORIAS CONSUMIDAS / META
              </p>
              <p className="font-display text-lg text-foreground">
                {todayKcal}
                <span className="text-sm text-muted-foreground"> / {dailyGoal ?? "—"} kcal</span>
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
              HISTÓRICO DE ALIMENTOS DE HOJE
            </p>
            {todayEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nada registrado ainda hoje.</p>
            ) : (
              <div className="space-y-2">
                {todayEntries.map((f) => (
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
                        {new Date(f.logged_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {f.quantity_text ? ` · ${f.quantity_text}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-display text-xs text-ember">{f.kcal} kcal</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(f.id)}
                      aria-label="Remover registro"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Gráfico de progressão semanal/mensal — dado real do diário */}
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
            <RangeChart data={range === "SEM" ? weekData : monthData} />
          </div>
        </div>
      </section>

      {/* Plano de dieta */}
      <section className="px-4 pt-4">
        {loading ? (
          <div className="h-32 animate-pulse rounded-2xl border border-border bg-charcoal-900/50" />
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
                onClick={openStructEditor}
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
              ALIMENTOS RECOMENDADOS PARA HOJE
            </p>
            <div className="flex flex-wrap gap-2">
              {plan.meals.map((m, i) => (
                <span
                  key={i}
                  className="rounded-full border border-border bg-charcoal-900/60 px-3 py-1.5 text-[11px] text-foreground"
                >
                  {m.time} · {m.name}
                </span>
              ))}
            </div>

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

      {/* FAB — registrar alimento (foto / código de barras / manual), tudo real */}
      <button
        type="button"
        onClick={openLog}
        aria-label="Registrar alimento"
        className="fixed bottom-28 right-4 z-40 grid h-14 w-14 place-items-center rounded-full border border-ember/40 bg-charcoal-900 text-ember forge-raised active:scale-95"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <Camera className="h-6 w-6" strokeWidth={2.2} />
      </button>

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
              Aqui você acompanha suas calorias do dia, vê sua progressão semanal/mensal e registra
              o que come por foto, código de barras ou texto.
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-xs text-muted-foreground">
              <li>O anel mostra o quanto você já consumiu perto da sua meta diária.</li>
              <li>
                Toque no botão de câmera pra registrar um alimento — a IA calcula e pede sua
                confirmação.
              </li>
              <li>A IA pode montar sua dieta agora, usando os dados do seu onboarding.</li>
            </ul>
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

      {/* Colar/editar dieta em texto */}
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

      {/* Edição direta (estruturada) do plano alimentar */}
      <Sheet open={structOpen} onOpenChange={setStructOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto flex max-h-[88vh] max-w-[var(--shell-max)] flex-col rounded-t-2xl border-border bg-charcoal-900/95 backdrop-blur-xl"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 font-display tracking-[0.18em] text-foreground">
              <Utensils className="h-4 w-4 text-ember" /> EDITAR PLANO ALIMENTAR
            </SheetTitle>
          </SheetHeader>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pb-2" data-lenis-prevent>
            <DietEditor value={draft} onChange={setDraft} />
          </div>
          <button
            type="button"
            onClick={handleSaveStruct}
            disabled={busy || draft.meals.length === 0}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ember px-3 py-3 font-display text-[11px] tracking-[0.2em] text-charcoal-900 disabled:opacity-50"
          >
            {busy ? "SALVANDO…" : "SALVAR ALTERAÇÕES"}
          </button>
        </SheetContent>
      </Sheet>

      {/* Scanner de código de barras (câmera) */}
      {scanOpen && (
        <BarcodeScanner onDetected={handleScanned} onClose={() => setScanOpen(false)} />
      )}

      {/* Registrar alimento — foto / código de barras / manual, cálculo real e confirmação */}
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
              <div className="flex gap-1.5 rounded-lg border border-border p-1">
                {(
                  [
                    { id: "foto", label: "FOTO", icon: Camera },
                    { id: "barcode", label: "CÓD. BARRAS", icon: ScanLine },
                    { id: "manual", label: "MANUAL", icon: PenLine },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setLogTab(t.id)}
                    className={
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 font-display text-[10px] tracking-[0.15em] " +
                      (logTab === t.id ? "bg-ember text-charcoal-900" : "text-muted-foreground")
                    }
                  >
                    <t.icon className="h-3.5 w-3.5" /> {t.label}
                  </button>
                ))}
              </div>

              {logTab === "foto" && (
                <>
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-charcoal-800/40 px-4 py-6 text-center">
                    <Camera className="h-6 w-6 text-ember" />
                    <span className="text-xs text-muted-foreground">
                      {photoFile ? photoFile.name : "Toque para enviar uma foto do alimento"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <Input
                    placeholder="Quantidade (opcional, ex.: 1 prato médio)"
                    value={photoHint}
                    onChange={(e) => setPhotoHint(e.target.value)}
                  />
                </>
              )}

              {logTab === "barcode" && (
                <>
                  <button
                    type="button"
                    onClick={() => setScanOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-ember/40 bg-ember/5 px-3 py-3 font-display text-[11px] tracking-[0.2em] text-ember active:scale-[0.99]"
                  >
                    <Camera className="h-4 w-4" /> ESCANEAR COM A CÂMERA
                  </button>
                  <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <ScanLine className="h-4 w-4 text-ember" />
                    <input
                      placeholder="Ou digite o código (EAN)"
                      inputMode="numeric"
                      value={barcodeValue}
                      onChange={(e) => setBarcodeValue(e.target.value.replace(/\D/g, ""))}
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                  <Input
                    placeholder="Quantidade em gramas (padrão 100g)"
                    inputMode="numeric"
                    value={barcodeGrams}
                    onChange={(e) => setBarcodeGrams(e.target.value.replace(/\D/g, ""))}
                  />
                </>
              )}

              {logTab === "manual" && (
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="Ex.: 1 prato de arroz, feijão e frango grelhado"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ember focus:outline-none"
                />
              )}

              <button
                type="button"
                onClick={handleCalculate}
                disabled={!canCalculate}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-ember px-3 py-2.5 font-display text-[11px] tracking-[0.2em] text-charcoal-900 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />{" "}
                {logTab === "barcode" ? "CONSULTAR" : "CALCULAR COM A IA"}
              </button>
            </div>
          )}

          {logStep === "calculating" && (
            <div className="mt-6 flex flex-col items-center gap-3 pb-6">
              <span className="ember-glow grid h-12 w-12 animate-pulse place-items-center rounded-2xl bg-charcoal-800 text-ember">
                <Sparkles className="h-6 w-6" />
              </span>
              <p className="font-display text-xs tracking-[0.2em] text-muted-foreground">
                {logTab === "barcode" ? "CONSULTANDO PRODUTO…" : "A IA ESTÁ CALCULANDO…"}
              </p>
            </div>
          )}

          {logStep === "confirm" && proposal && (
            <div className="mt-3 space-y-3 pb-2">
              <div className="rounded-xl border border-ember/30 bg-ember/5 p-3.5">
                <p className="font-display text-[10px] tracking-[0.25em] text-ember">
                  RESULTADO ESTIMADO
                </p>
                <p className="mt-1 font-display text-lg text-foreground">{proposal.name}</p>
                <p className="text-sm text-muted-foreground">
                  {proposal.kcal} kcal · {proposal.quantity_text}
                </p>
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
                  disabled={busy}
                  className="flex-1 rounded-lg bg-ember px-3 py-2.5 font-display text-[11px] tracking-[0.2em] text-charcoal-900 disabled:opacity-50"
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
