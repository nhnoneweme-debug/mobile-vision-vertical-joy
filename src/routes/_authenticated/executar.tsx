// Palco de execução da WiMi — AMBIENTE AGENTE.
// Fusão Palco + Live: existe uma tela única (Live) com relógio, jornada,
// registro colapsável e os sensores/atuadores. A aba Gatilhos separa
// AGENTES (proativos) de COMANDOS (reativos). O ambiente reagente
// (planejar/conversar) fica a um atalho de distância.

import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, CalendarPlus, MessageCircle } from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";
import { JourneyAgent, type JourneyManifestation } from "@/components/assistente/JourneyAgent";
import { useActiveJourney, type JourneyBlock } from "@/hooks/useActiveJourney";
import { JourneyTimeline, type TimelineItem } from "@/components/executar/JourneyTimeline";
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
  const [tab, setTab] = useState<"palco" | "live" | "gatilhos">("palco");

  // Timeline com estado por bloco.
  const timeline: TimelineItem[] = useMemo(() => {
    const now = journey.nowMin;
    return journey.blocks.map((b: JourneyBlock) => {
      if (b.endMin <= now) return { block: b, state: "done" as const };
      if (b.startMin <= now && b.endMin > now) {
        return { block: b, state: "now" as const, remaining: Math.max(0, b.endMin - now) };
      }
      return { block: b, state: "future" as const, remaining: Math.max(0, b.startMin - now) };
    });
  }, [journey.blocks, journey.nowMin]);

  const handleManifest = useCallback((m: JourneyManifestation) => {
    setManifestChannel("foreground");
    setManifest(m);
  }, []);

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
          {(["palco", "live", "gatilhos"] as const).map((t) => (
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
              {t === "palco" ? "Palco" : t === "live" ? "Live" : "Gatilhos"}
            </button>
          ))}
        </div>
      </header>

      {/* O painel Live fica montado durante toda a sessão: trocar de aba não pode
          matar os cronômetros do motor de gatilhos nem reiniciar a sessão. */}
      <div className={tab === "live" ? "px-4 py-5 pb-40" : "hidden"} aria-hidden={tab !== "live"}>
        <LivePanel missionId={journey.current?.id ?? null} />
      </div>

      {tab === "gatilhos" ? (
        <div className="px-4 py-5 pb-40">
          <TriggersSection />
        </div>
      ) : tab === "live" ? null : (
        <div className="space-y-5 px-4 py-5 pb-40">
          <section className="rounded-2xl border border-ember/30 bg-ember/5 p-4">
            <LiveClock />
            <BlockNowSummary journey={journey} />
            {/* Trigger de conversa acompanhada — não sai da tela. */}
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
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-ember/40 bg-ember/10 px-3 py-1.5 text-xs text-ember active:scale-95"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Conversar sem sair do palco
            </button>
          </section>

          <section>
            <h2 className="mb-2 font-display text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Timeline de hoje
            </h2>
            <JourneyTimeline items={timeline} />
          </section>

          <ExecutionLogCard />
        </div>
      )}

      {manifest ? (
        <ManifestPanel
          manifestation={manifest}
          mission={missionForManifest}
          channel={manifestChannel}
          onResolved={() => {
            setManifest(null);
            void qc.invalidateQueries({ queryKey: ["execution-log", "today"] });
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
    </MobileShell>
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
