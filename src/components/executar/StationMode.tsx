// Modo Estação — variante de tela cheia do painel Live, pensada pro celular
// apoiado num suporte e ligado na tomada. Indicadores grandes, relógio e pausa
// sempre acessível. Recebe todo o estado do LivePanel (fonte única).

import { Ear, Minimize2, Pause, Play, Radio, Volume2, Vibrate, Waves } from "lucide-react";
import { LiveClock } from "./LiveClock";

export type StationProps = {
  listening: boolean;
  micSupported: boolean;
  onToggleListening: () => void;
  motionActive: boolean;
  motionMagnitude: number;
  motionDominant: string;
  vibrationOn: boolean;
  audioOn: boolean;
  wakeActive: boolean;
  transcriptPreview: string;
  blocksSaved: number;
  spikes: number;
  offline: boolean;
  onExit: () => void;
  onPauseAll: () => void;
};

function Big({
  label,
  on,
  icon,
  detail,
}: {
  label: string;
  on: boolean;
  icon: React.ReactNode;
  detail?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center ${
        on
          ? "border-ember/60 bg-ember/10 text-ember"
          : "border-border bg-charcoal-900/60 text-muted-foreground"
      }`}
    >
      <div className={on ? "animate-pulse" : ""}>{icon}</div>
      <p className="mt-2 font-display text-[11px] uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-0.5 text-[11px] opacity-80">{detail ?? (on ? "ativo" : "desligado")}</p>
    </div>
  );
}

export function StationMode(props: StationProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-charcoal-900 px-5 py-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.2em] text-ember">
            Modo estação
          </p>
          <p className="text-[11px] text-muted-foreground">
            {props.offline ? "offline — eventos pausados" : "monitorando ao vivo"}
          </p>
        </div>
        <button
          type="button"
          onClick={props.onExit}
          aria-label="Sair do modo estação"
          className="rounded-full border border-border p-2 text-muted-foreground active:scale-95"
        >
          <Minimize2 className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 scale-[1.15] origin-left">
        <LiveClock />
      </div>

      <div className="mt-6 grid flex-1 grid-cols-2 content-start gap-3">
        <Big
          label="Microfone"
          on={props.listening}
          icon={<Ear className="h-9 w-9" />}
          detail={
            !props.micSupported
              ? "sem suporte"
              : props.listening
                ? `${props.blocksSaved} blocos salvos`
                : "pausado"
          }
        />
        <Big
          label="Movimento"
          on={props.motionActive}
          icon={<Waves className="h-9 w-9" />}
          detail={
            props.motionActive
              ? `${props.motionDominant} · ${props.motionMagnitude.toFixed(1)} m/s² · ${props.spikes} picos`
              : "desligado"
          }
        />
        <Big label="Vibração" on={props.vibrationOn} icon={<Vibrate className="h-9 w-9" />} />
        <Big label="Áudio" on={props.audioOn} icon={<Volume2 className="h-9 w-9" />} />
      </div>

      <div className="rounded-2xl border border-border bg-charcoal-900/70 p-3">
        <p className="flex items-center gap-2 font-display text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <Radio className="h-3.5 w-3.5" /> transcrição
        </p>
        <p className="mt-1 line-clamp-3 text-sm text-foreground">
          {props.transcriptPreview || (props.listening ? "ouvindo…" : "microfone pausado")}
        </p>
      </div>

      <div className="mt-4 flex gap-3 pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={props.onToggleListening}
          disabled={!props.micSupported}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-ember/50 bg-ember/15 py-4 text-sm text-ember disabled:opacity-40 active:scale-95"
        >
          {props.listening ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          {props.listening ? "Pausar escuta" : "Retomar escuta"}
        </button>
        <button
          type="button"
          onClick={props.onPauseAll}
          className="rounded-2xl border border-border px-5 py-4 text-sm text-muted-foreground active:scale-95"
        >
          Pausar tudo
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        tela ligada: {props.wakeActive ? "sim (wake lock ativo)" : "não garantida"}
      </p>
    </div>
  );
}
