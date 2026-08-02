// Modo Estação — variante de tela cheia do painel Live, pensada pro celular
// apoiado num suporte e ligado na tomada. Indicadores grandes, relógio e pausa
// sempre acessível. Recebe todo o estado do LivePanel (fonte única).

import {
  Camera,
  CameraOff,
  Ear,
  Minimize2,
  Pause,
  Play,
  Radio,
  SwitchCamera,
  Volume2,
  Vibrate,
} from "lucide-react";
import type { ReactNode } from "react";
import { LiveClock } from "./LiveClock";
import { useActuators } from "@/providers/ActuatorsProvider";

export type StationProps = {
  listening: boolean;
  micSupported: boolean;
  onToggleListening: () => void;
  vibrationOn: boolean;
  audioOn: boolean;
  wakeActive: boolean;
  transcriptLines: string[];
  blocksSaved: number;
  offline: boolean;
  cameraLive: boolean;
  cameraNode: ReactNode;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onExit: () => void;
  onPauseAll: () => void;
  /** Overlay de próximas ações — renderizado no topo do modo imersivo. */
  overlay?: React.ReactNode;
};

function Big({
  label,
  on,
  icon,
  detail,
  bar,
}: {
  label: string;
  on: boolean;
  icon: React.ReactNode;
  detail?: string;
  bar?: number;
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
      {bar != null ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-charcoal-950/70">
          <div
            className="h-full rounded-full bg-ember transition-[width] duration-100"
            style={{ width: `${Math.round(Math.min(1, bar) * 100)}%` }}
          />
        </div>
      ) : null}
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
      {props.overlay ? <div className="mt-3">{props.overlay}</div> : null}

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
          label="Câmera"
          on={props.cameraLive}
          icon={<Camera className="h-9 w-9" />}
          detail={props.cameraLive ? "ao vivo" : "desligada"}
        />
        <Big label="Vibração" on={props.vibrationOn} icon={<Vibrate className="h-9 w-9" />} />
        <AudioBig on={props.audioOn} />
      </div>

      {props.cameraLive ? (
        <div className="relative mb-3 aspect-video overflow-hidden rounded-2xl border border-ember/40">
          {props.cameraNode}
          <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-charcoal-950/80 px-2 py-1 text-[10px] uppercase tracking-wide text-ember">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ember" /> câmera ativa
          </span>
          <button
            type="button"
            onClick={props.onFlipCamera}
            aria-label="Alternar câmera"
            className="absolute right-2 top-2 rounded-full bg-charcoal-950/80 p-2 text-muted-foreground active:scale-95"
          >
            <SwitchCamera className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={props.onToggleCamera}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-2 text-[12px] text-muted-foreground active:scale-95"
      >
        {props.cameraLive ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
        {props.cameraLive ? "Desligar câmera" : "Ligar câmera"}
      </button>

      <div className="rounded-2xl border border-border bg-charcoal-900/70 p-3">
        <p className="flex items-center gap-2 font-display text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <Radio className="h-3.5 w-3.5" /> transcrição
        </p>
        <div className="mt-1 max-h-24 space-y-0.5 overflow-y-auto text-sm">
          {props.transcriptLines.length === 0 ? (
            <p className="text-muted-foreground">
              {props.listening ? "ouvindo…" : "microfone pausado"}
            </p>
          ) : (
            props.transcriptLines.map((line, i) => (
              <p
                key={`${i}-${line.slice(0, 12)}`}
                className={
                  i === props.transcriptLines.length - 1
                    ? "text-foreground"
                    : "text-muted-foreground"
                }
              >
                {line}
              </p>
            ))
          )}
        </div>
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

/** Indicador grande de áudio — mostra o beacon de presença quando ativo. */
function AudioBig({ on }: { on: boolean }) {
  const { audioConfig } = useActuators();
  const beacon = audioConfig.beacon?.on ? audioConfig.beacon : null;
  return (
    <Big
      label="Áudio"
      on={on}
      icon={<Volume2 className="h-9 w-9" />}
      detail={on ? (beacon ? `beacon a cada ${beacon.value} ${beacon.unit}` : "ativo") : "desligado"}
    />
  );
}
