// Indicador compacto dos atuadores — visível em qualquer tela do Executando.
// Mostra vibração/áudio ligados e permite desligar tudo com um toque.

import { Vibrate, Volume2 } from "lucide-react";
import { useActuators } from "@/providers/ActuatorsProvider";

export function ActuatorsIndicator() {
  const { vibrationOn, audioOn, pulsing, stopAll } = useActuators();
  if (!vibrationOn && !audioOn) return null;
  return (
    <button
      type="button"
      onClick={stopAll}
      title="Desligar atuadores"
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-ember/40 bg-ember/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-ember active:scale-95"
    >
      {vibrationOn ? (
        <Vibrate className={`h-3.5 w-3.5 ${pulsing.vibration ? "animate-pulse" : ""}`} />
      ) : null}
      {audioOn ? (
        <Volume2 className={`h-3.5 w-3.5 ${pulsing.audio ? "animate-pulse" : ""}`} />
      ) : null}
      on
    </button>
  );
}
