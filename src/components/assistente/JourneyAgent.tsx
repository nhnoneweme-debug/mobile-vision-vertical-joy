// Agente de manifestação da WiMi.
//
// Não renderiza nada. Fica observando o (current, next) do useActiveJourney e,
// quando cruza um dos gatilhos negociados com o usuário (atStart, preEnd,
// atEnd, preStart), chama `onManifest` uma vez para aquele bloco/fase —
// evitando repetição via localStorage. É o coração da "IA que se manifesta
// sozinha".

import { useEffect, useRef } from "react";
import type { ActiveJourney, JourneyBlock } from "@/hooks/useActiveJourney";
import {
  loadAgreements,
  markFired,
  wasFired,
  type JourneyAgreements,
  type JourneyPhase,
} from "@/lib/journey-agreements";
import { suggestActions, type JourneySuggestion } from "@/lib/journey-suggestions";

export type JourneyManifestation = {
  phase: JourneyPhase;
  block: JourneyBlock;
  suggestions: JourneySuggestion[];
  message: string;
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Kickoffs épicos por área — a WiMi levanta a voz. Escolha determinística pelo
// id do bloco para não trocar de frase entre re-renders do mesmo start.
const KICKOFF_TEMPLATES: Record<string, string[]> = {
  treino: [
    'Levanta. Corpo em campo. "{t}" começa agora — cada série é uma promessa cumprida.',
    'Ferro chama, "{t}" abre. Respira fundo e coloca intenção em cada movimento.',
    'É o momento. "{t}" agora. Não vim assistir — vim contigo.',
  ],
  cozinha: [
    'À mesa com propósito. "{t}" — nutrir é decisão, não impulso.',
    '"{t}" começa. Cada garfada é o corpo dizendo obrigado ao plano.',
    'Hora de "{t}". Come devagar, presta atenção, honra o que escolheste.',
  ],
  mental: [
    'Silêncio interno agora. "{t}" começa — respira, escuta, sente.',
    '"{t}". A mente pede espaço, e tu abres a porta.',
    'Entra em "{t}" com coragem: o que vier, tu recebes.',
  ],
  quarto: [
    'Baixa a rotação. "{t}" — o descanso é onde a força se refaz.',
    'Apaga o mundo por um instante. "{t}" começa e o corpo recompensa.',
    '"{t}". Fechar os olhos hoje é combustível pra amanhã.',
  ],
  descanso: [
    'Pausa consciente: "{t}". Recarrega, o próximo bloco te espera pronto.',
    '"{t}". Solta os ombros, respira lento — a pausa também é trabalho.',
    'Freio propositado. "{t}" — voltar mais forte é a meta.',
  ],
  geral: [
    'É AGORA. "{t}" — sobe no palco e faz acontecer.',
    'A hora é essa. "{t}" começa, e tu com ela.',
    '"{t}" — o plano vira ação, a ação vira quem tu és.',
    'Levanta a cabeça: "{t}". Nós dois nisso, do começo ao fim.',
  ],
};

function pickKickoff(area: string | null | undefined, title: string, seedKey: string): string {
  const a = (area ?? "").toLowerCase();
  const pool = KICKOFF_TEMPLATES[a] ?? KICKOFF_TEMPLATES.geral;
  // hash simples pra escolher determinístico
  let h = 0;
  for (let i = 0; i < seedKey.length; i++) h = (h * 31 + seedKey.charCodeAt(i)) >>> 0;
  const tpl = pool[h % pool.length] ?? pool[0];
  return tpl.replace("{t}", title);
}

function buildMessage(phase: JourneyPhase, block: JourneyBlock): string {
  const t = block.title;
  if (phase === "preEnd") return `Faltam pouquinho pro fim de "${t}". Como está indo?`;
  if (phase === "atEnd") return `"${t}" terminou. Quer fechar como feito ou ajustar?`;
  if (phase === "preStart") return `"${t}" tá começando. Bora?`;
  // atStart: kickoff épico
  return pickKickoff(block.area, t, `${block.id}:${todayIso()}`);
}

export function JourneyAgent({
  journey,
  onManifest,
  agreementsVersion = 0,
}: {
  journey: ActiveJourney;
  onManifest: (m: JourneyManifestation) => void;
  // Passe um valor que muda quando o usuário edita os acordos — força reler.
  agreementsVersion?: number;
}) {
  const agreementsRef = useRef<JourneyAgreements>(loadAgreements());
  useEffect(() => {
    agreementsRef.current = loadAgreements();
  }, [agreementsVersion]);

  const { current, next, minutesToEndOfCurrent, minutesToStartOfNext, nowMin } = journey;

  useEffect(() => {
    const iso = todayIso();
    const a = agreementsRef.current;

    // atStart: kickoff épico logo quando o bloco vira "atual" (dentro da
    // tolerância). Precede preEnd/atEnd na verificação para nunca ser abafado.
    if (current) {
      const sinceStart = nowMin - current.startMin;
      if (
        sinceStart >= 0 &&
        sinceStart <= Math.max(1, a.atStart) &&
        !wasFired(current.id, iso, "atStart")
      ) {
        markFired(current.id, iso, "atStart");
        onManifest({
          phase: "atStart",
          block: current,
          suggestions: suggestActions(current.area, current.title, "atStart"),
          message: buildMessage("atStart", current),
        });
        return; // dá espaço pro épico; próximos ticks tratam os demais gatilhos
      }
    }

    // preEnd: aviso antes de terminar o bloco atual.
    if (current && minutesToEndOfCurrent != null) {
      if (
        minutesToEndOfCurrent <= a.preEnd &&
        minutesToEndOfCurrent > 0 &&
        !wasFired(current.id, iso, "preEnd")
      ) {
        markFired(current.id, iso, "preEnd");
        onManifest({
          phase: "preEnd",
          block: current,
          suggestions: suggestActions(current.area, current.title, "preEnd"),
          message: buildMessage("preEnd", current),
        });
      }
      // atEnd: quando bate o fim (tolerância 0-atEnd).
      if (minutesToEndOfCurrent === 0 && !wasFired(current.id, iso, "atEnd")) {
        markFired(current.id, iso, "atEnd");
        onManifest({
          phase: "atEnd",
          block: current,
          suggestions: suggestActions(current.area, current.title, "atEnd"),
          message: buildMessage("atEnd", current),
        });
      }
    }
    // preStart: aviso antes do próximo começar.
    if (next && minutesToStartOfNext != null) {
      if (
        minutesToStartOfNext <= a.preStart &&
        minutesToStartOfNext > 0 &&
        !wasFired(next.id, iso, "preStart")
      ) {
        markFired(next.id, iso, "preStart");
        onManifest({
          phase: "preStart",
          block: next,
          suggestions: suggestActions(next.area, next.title, "preStart"),
          message: buildMessage("preStart", next),
        });
      }
    }
  }, [current, next, minutesToEndOfCurrent, minutesToStartOfNext, nowMin, onManifest]);

  return null;
}
