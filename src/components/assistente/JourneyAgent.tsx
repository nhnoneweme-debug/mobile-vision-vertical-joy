// Agente de manifestação da WiMi.
//
// Não renderiza nada. Fica observando o (current, next) do useActiveJourney e,
// quando cruza um dos gatilhos negociados com o usuário (preEnd, atEnd,
// preStart), chama `onManifest` uma vez para aquele bloco/fase — evitando
// repetição via localStorage. É o coração da "IA que se manifesta sozinha".

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

function buildMessage(phase: JourneyPhase, block: JourneyBlock): string {
  const t = block.title;
  if (phase === "preEnd") return `Faltam pouquinho pro fim de "${t}". Como está indo?`;
  if (phase === "atEnd") return `"${t}" terminou. Quer fechar como feito ou ajustar?`;
  return `"${t}" tá começando. Bora?`;
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

  const { current, next, minutesToEndOfCurrent, minutesToStartOfNext } = journey;

  useEffect(() => {
    const iso = todayIso();
    const a = agreementsRef.current;

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
  }, [current, next, minutesToEndOfCurrent, minutesToStartOfNext, onManifest]);

  return null;
}
