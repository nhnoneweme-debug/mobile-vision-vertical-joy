// Palco de execução da WiMi — AMBIENTE AGENTE.
// Fusão Palco + Live: existe uma tela única (Live) com relógio, jornada,
// registro colapsável e os sensores/atuadores. A aba Ações separa
// AGENTES (proativos) de COMANDOS (reativos). O ambiente reagente
// (planejar/conversar) fica a um atalho de distância.

import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, CalendarPlus, MessageCircle, MoonStar, PlusCircle, Sunrise } from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";
import { JourneyAgent, type JourneyManifestation } from "@/components/assistente/JourneyAgent";
import { useActiveJourney } from "@/hooks/useActiveJourney";
import { TodayTimeline, useTodayEntries } from "@/components/executar/TodayTimeline";
import { RegisterSheet } from "@/components/executar/RegisterSheet";
import { DayReviewSheet } from "@/components/executar/DayReviewSheet";
import { ManifestPanel } from "@/components/executar/ManifestPanel";
import { ExecutarChatDrawer } from "@/components/executar/ExecutarChatDrawer";
import { LivePanel } from "@/components/executar/LivePanel";
import { TriggersSection } from "@/components/executar/TriggersSection";
import { ActuatorsIndicator } from "@/components/executar/ActuatorsIndicator";
import { formatMomentLabel, getClientMoment } from "@/lib/client-moment";
import { logExecutionEvent } from "@/lib/execution.functions";
import { useQueryClient } from "@tanstack/react-query";

type SeedSearch = { seed?: string };

export const Route = createFileRoute("/_authenticated/executar")({
  validateSearch: (s: Record<string, unknown>): SeedSearch => ({
    seed: typeof s.seed === "string" ? s.seed : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Executando — WiMi" },
      {
        name: "description",
        content:
          "Palco vivo com relógio, timeline da jornada e a WiMi se manifestando pra te acompanhar.",
      },
      { property: "og:title", content: "Executando — WiMi" },
      {
        property: "og:description",
        content: "Painel live: microfone, movimento e atuadores acompanhando sua execução.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExecutarPage,
});

function ExecutarPage() {
  const journey = useActiveJourney();
  const search = useSearch({ from: "/_authenticated/executar" }) as SeedSearch;
  const qc = useQueryClient();

  const [manifest, setManifest] = useState<JourneyManifestation | null>(null);
  const [manifestChannel, setManifestChannel] = useState<"foreground" | "push">("foreground");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSeed, setChatSeed] = useState<string | null>(null);
  const seedProcessedRef = useRef(false);
  // Não existem dois palcos: "live" é a tela única do ambiente agente.
  const [tab, setTab] = useState<"live" | "gatilhos">("live");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [dayReviewOpen, setDayReviewOpen] = useState(false);

  // Entradas REAIS de hoje — a timeline não conhece plano nenhum, e o ritual
  // da noite se ancora exatamente nelas.
  const todayEntries = useTodayEntries();
  const reviewEntries = useMemo(
    () => todayEntries.map((e) => ({ time: e.time, label: e.title })),
    [todayEntries],
  );

  const handleManifest = useCallback((m: JourneyManifestation) => {
    setManifestChannel("foreground");
    setManifest(m);
  }, []);

  // Deep-link do push das AÇÕES: ?seed=action:<triggerId> — abre o Studio de
  // Ações já na aba certa, com o Live montado para executar o que faltava.
  useEffect(() => {
    const seed = search.seed;
    if (!seed || !seed.startsWith("action:")) return;
    setTab("gatilhos");
  }, [search.seed]);

  // Deep-link do push: ?seed=manifest:<missionId>:<phase>
  useEffect(() => {
    if (seedProcessedRef.current) return;
    const seed = search.seed;
    if (!seed || !seed.startsWith("manifest:")) return;
    const [, missionId, phase] = seed.split(":");
    if (!missionId || !phase) return;
    const block = journey.blocks.find((b) => b.id === missionId);
    if (!block) return; // ainda carregando; tentará no próximo render
    seedProcessedRef.current = true;
    setManifestChannel("push");
    setManifest({
      phase: phase as JourneyManifestation["phase"],
      block,
      suggestions: [],
      message:
        phase === "preEnd"
          ? `faltando pouco pra fechar "${block.title}". como tá indo?`
          : phase === "atEnd"
            ? `"${block.title}" terminou. bora fechar ou estender?`
            : phase === "atStart"
              ? `é AGORA. "${block.title}" começa — nós dois nisso.`
              : `"${block.title}" tá começando. bora?`,
    });
  }, [search.seed, journey.blocks]);

  const missionForManifest = useMemo(() => {
    if (!manifest) return null;
    return journey.blocks.find((b) => b.id === manifest.block.id)?.raw ?? null;
  }, [manifest, journey.blocks]);

  return (
    <MobileShell>
      <JourneyAgent journey={journey} onManifest={handleManifest} />

      <header className="sticky top-0 z-20 border-b border-border bg-charcoal-900/85 px-4 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 shrink-0 text-ember" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl tracking-wide">EXECUTANDO</h1>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {formatMomentLabel(getClientMoment())}
            </p>
          </div>
          <ActuatorsIndicator />
        </div>

        <div className="mt-3 flex gap-2">
          {(["live", "gatilhos"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`rounded-full px-3.5 py-1.5 font-display text-[11px] uppercase tracking-[0.16em] transition ${
                tab === t
                  ? "bg-ember/15 text-ember ring-1 ring-ember/40"
                  : "text-muted-foreground ring-1 ring-border"
              }`}
            >
              {t === "live" ? "Live" : "Ações"}
            </button>
          ))}
        </div>
      </header>

      {/* O painel Live fica montado durante toda a sessão: trocar de aba não pode
          matar os cronômetros do motor de gatilhos nem reiniciar a sessão. */}
      <div className={tab === "live" ? "px-4 py-5 pb-40" : "hidden"} aria-hidden={tab !== "live"}>
        <LivePanel
          missionId={journey.current?.id ?? null}
          onOpenCommands={() => setTab("gatilhos")}
          header={
            <>
              <BlockNowSummary journey={journey} />
              {/* PONTE AGENTE → REAGENTE: o ambiente que espera o usuário. */}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const now = journey.current;
                    const ctx = now
                      ? `Estou executando "${now.title}" agora${
                          journey.minutesToEndOfCurrent != null
                            ? ` (faltam ${journey.minutesToEndOfCurrent}min)`
                            : ""
                        }. Fica de olho comigo — vou falar aqui do palco de execução.`
                      : "Estou no palco de execução, entre blocos. Me acompanha?";
                    setChatSeed(ctx);
                    setChatOpen(true);
                  }}
                  className="inline-flex min-w-0 items-center gap-2 rounded-full border border-ember/40 bg-ember/10 px-3 py-1.5 text-xs text-ember active:scale-95"
                >
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Conversar</span>
                </button>
                <Link
                  to="/planejar"
                  className="inline-flex min-w-0 items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground active:scale-95"
                >
                  <CalendarPlus className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Criar plano</span>
                </Link>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Timeline de hoje · executado
                  </h2>
                  <button
                    type="button"
                    onClick={() => setRegisterOpen(true)}
                    className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-ember/40 bg-ember/10 px-3 py-1 text-[11px] text-ember active:scale-95"
                  >
                    <PlusCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Registrar</span>
                  </button>
                </div>
                <RitualShortcuts onNight={() => setDayReviewOpen(true)} />
                <TodayTimeline onRegister={() => setRegisterOpen(true)} />
              </div>
            </>
          }
        />
      </div>

      {tab === "gatilhos" ? (
        <div className="px-4 py-5 pb-40">
          <TriggersSection />
        </div>
      ) : null}

      {manifest ? (
        <ManifestPanel
          manifestation={manifest}
          mission={missionForManifest}
          channel={manifestChannel}
          onResolved={() => {
            setManifest(null);
            void qc.invalidateQueries({ queryKey: ["execution-log"] });
            journey.refresh();
          }}
          onOpenAssistant={() => {
            void logExecutionEvent({
              data: {
                mission_id: manifest.block.id,
                kind: "negotiation",
                phase: manifest.phase,
                channel: "manual",
                meta: { destination: "executar-chat" },
              },
            }).catch(() => {});
            // Em vez de mandar pro /assistente e perder o palco, abrimos o
            // drawer inline com contexto do bloco em negociação.
            setChatSeed(
              `Sobre "${manifest.block.title}" (${phaseText(manifest.phase)}): ${manifest.message}`,
            );
            setChatOpen(true);
            setManifest(null);
          }}
        />
      ) : null}

      <ExecutarChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} seed={chatSeed} />

      {registerOpen ? (
        <RegisterSheet
          missionId={journey.current?.id ?? null}
          onClose={() => setRegisterOpen(false)}
        />
      ) : null}

      {dayReviewOpen ? (
        <DayReviewSheet entries={reviewEntries} onClose={() => setDayReviewOpen(false)} />
      ) : null}
    </MobileShell>
  );
}

/**
 * Atalhos discretos que aparecem conforme a hora: de noite, registrar o dia
 * (ancorado na timeline); de manhã, registrar o sonho no fluxo já existente
 * de /despertar/sonho (dream_logs).
 */
function RitualShortcuts({ onNight }: { onNight: () => void }) {
  const hour = new Date().getHours();
  const night = hour >= 20 || hour < 3;
  const morning = hour >= 4 && hour < 11;
  if (!night && !morning) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {night ? (
        <button
          type="button"
          onClick={onNight}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-ember/40 bg-ember/10 px-3 py-1 text-[11px] text-ember active:scale-95"
        >
          <MoonStar className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Registrar meu dia</span>
        </button>
      ) : null}
      {morning ? (
        <Link
          to="/despertar/sonho"
          search={{ session: "" }}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground active:scale-95"
        >
          <Sunrise className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Registrar sonho</span>
        </Link>
      ) : null}
    </div>
  );
}

function phaseText(p: JourneyManifestation["phase"]): string {
  if (p === "preEnd") return "faltando pouco pra fechar";
  if (p === "atEnd") return "no fim do bloco";
  if (p === "atStart") return "kickoff épico";
  return "começando agora";
}

function BlockNowSummary({ journey }: { journey: ReturnType<typeof useActiveJourney> }) {
  const { current, minutesToEndOfCurrent, progressPct, next, minutesToStartOfNext } = journey;
  if (!current && !next) {
    return (
      <p className="mt-3 text-[12px] text-muted-foreground">
        Nada em execução no momento. A WiMi avisa quando o próximo bloco chegar.
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      {current ? (
        <div>
          <p className="text-sm text-foreground">
            <span className="font-display text-[10px] uppercase tracking-[0.15em] text-ember">
              agora ·{" "}
            </span>
            {current.title}
            {minutesToEndOfCurrent != null ? (
              <span className="text-muted-foreground"> · {minutesToEndOfCurrent}min restantes</span>
            ) : null}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-charcoal-800">
            <div
              className="h-full bg-ember transition-[width] duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      ) : null}
      {next ? (
        <p className="text-[12px] text-muted-foreground">
          a seguir · {next.title}
          {minutesToStartOfNext != null ? ` · em ${minutesToStartOfNext}min` : ""}
        </p>
      ) : null}
    </div>
  );
}
