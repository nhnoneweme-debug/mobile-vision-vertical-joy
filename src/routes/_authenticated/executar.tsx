// Palco de execução da WiMi.
// Relógio ao vivo + timeline da jornada + manifestação in-place (voz + mic +
// negociação) + log persistente. O JourneyAgent local dispara as manifestações
// e o ManifestPanel é a interface viva. Toda ação relevante grava um
// execution_event no banco.

import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, MessageCircle } from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";
import { JourneyAgent, type JourneyManifestation } from "@/components/assistente/JourneyAgent";
import { useActiveJourney, type JourneyBlock } from "@/hooks/useActiveJourney";
import { LiveClock } from "@/components/executar/LiveClock";
import { JourneyTimeline, type TimelineItem } from "@/components/executar/JourneyTimeline";
import { ManifestPanel } from "@/components/executar/ManifestPanel";
import { ExecutionLogCard } from "@/components/executar/ExecutionLogCard";
import { ExecutarChatDrawer } from "@/components/executar/ExecutarChatDrawer";
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
      { title: "Executar — WiMi" },
      {
        name: "description",
        content: "Palco vivo com relógio, timeline da jornada e a WiMi se manifestando pra te acompanhar.",
      },
    ],
  }),
  component: ExecutarPage,
});

function ExecutarPage() {
  const journey = useActiveJourney();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/executar" }) as SeedSearch;
  const qc = useQueryClient();

  const [manifest, setManifest] = useState<JourneyManifestation | null>(null);
  const [manifestChannel, setManifestChannel] = useState<"foreground" | "push">("foreground");
  const seedProcessedRef = useRef(false);

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

  const handleManifest = useCallback(
    (m: JourneyManifestation) => {
      setManifestChannel("foreground");
      setManifest(m);
    },
    [],
  );

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
            <h1 className="font-display text-xl tracking-wide">EXECUTAR</h1>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {formatMomentLabel(getClientMoment())}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-5 px-4 py-5 pb-40">
        <section className="rounded-2xl border border-ember/30 bg-ember/5 p-4">
          <LiveClock />
          <BlockNowSummary journey={journey} />
        </section>

        <section>
          <h2 className="mb-2 font-display text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Timeline de hoje
          </h2>
          <JourneyTimeline items={timeline} />
        </section>

        <ExecutionLogCard />
      </div>

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
                meta: { destination: "assistente" },
              },
            }).catch(() => {});
            const seed = `manifest:${manifest.block.id}:${manifest.phase}`;
            setManifest(null);
            navigate({ to: "/assistente", search: { seed } as never });
          }}
        />
      ) : null}
    </MobileShell>
  );
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
            <span className="font-display text-[10px] uppercase tracking-[0.15em] text-ember">agora · </span>
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
