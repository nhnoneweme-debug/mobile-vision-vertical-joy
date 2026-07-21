// Painel de manifestação da WiMi dentro do /executar.
// Recebe a manifestação disparada pelo JourneyAgent, fala, abre o microfone
// e oferece ações rápidas (concluir, estender, pular, conversar).
// Toda ação relevante gera um execution_event via server function.

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Mic, MicOff, MessageCircle, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import type { JourneyManifestation } from "@/components/assistente/JourneyAgent";
import { vibrateFor, playPing } from "@/components/assistente/JourneyManifestFX";
import { loadAgreements } from "@/lib/journey-agreements";
import { playAssistantTts, stopAssistantTts } from "@/lib/tts-play";
import { parseExecuteIntent } from "@/lib/execute-intent";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { logExecutionEvent, extendMissionToday } from "@/lib/execution.functions";
import { markMissionToday, type UserMissionWithMeta } from "@/lib/missions";
import { supabase } from "@/integrations/supabase/client";

export type ManifestAction =
  | { kind: "done" }
  | { kind: "skip" }
  | { kind: "extend"; minutes: number }
  | { kind: "note"; text: string }
  | { kind: "converse" };

export function ManifestPanel({
  manifestation,
  mission,
  channel = "foreground",
  onResolved,
  onOpenAssistant,
}: {
  manifestation: JourneyManifestation;
  mission: UserMissionWithMeta | null;
  channel?: "foreground" | "push";
  onResolved: (action: ManifestAction) => void;
  onOpenAssistant: () => void;
}) {
  const shownAtRef = useRef<number>(performance.now());
  const [busy, setBusy] = useState(false);
  const [heardText, setHeardText] = useState<string>("");
  const agreements = loadAgreements();

  const handleFinal = useCallback((text: string) => {
    setHeardText((prev) => `${prev} ${text}`.trim().slice(-240));
    const intent = parseExecuteIntent(text);
    if (!intent) return;
    if (intent.kind === "done") void ackAndResolve({ kind: "done" }, "voice");
    else if (intent.kind === "skip") void ackAndResolve({ kind: "skip" }, "voice");
    else if (intent.kind === "extend") void ackAndResolve({ kind: "extend", minutes: intent.minutes }, "voice");
    else if (intent.kind === "note") void ackAndResolve({ kind: "note", text: intent.text }, "voice");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speech = useSpeechToText(handleFinal, { continuous: true });

  // Ao montar: vibra, ping/fala, log manifest_shown, e inicia mic depois da fala.
  useEffect(() => {
    let cancelled = false;
    shownAtRef.current = performance.now();

    if (agreements.notify.vibrate) vibrateFor(manifestation.phase);

    void logExecutionEvent({
      data: {
        mission_id: manifestation.block.id,
        kind: "manifest_shown",
        phase: manifestation.phase,
        channel,
        meta: { title: manifestation.block.title, area: manifestation.block.area },
      },
    }).catch(() => {});

    (async () => {
      if (agreements.notify.voice) {
        // gênero de voz vem do chat_settings; usa 'feminina' como default seguro.
        const gender = await readVoiceGender();
        if (cancelled) return;
        await playAssistantTts(manifestation.message, { gender });
      } else if (agreements.notify.vibrate) {
        playPing(manifestation.phase);
      }
      if (cancelled) return;
      if (agreements.notify.autoMic && speech.supported) {
        speech.start();
        // fecha o mic sozinho após 20s se ninguém falar
        window.setTimeout(() => {
          if (!cancelled) speech.stop();
        }, 20_000);
      }
    })();

    return () => {
      cancelled = true;
      stopAssistantTts();
      speech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifestation.block.id, manifestation.phase]);

  async function ackAndResolve(action: ManifestAction, source: "click" | "voice") {
    if (busy) return;
    setBusy(true);
    stopAssistantTts();
    speech.stop();

    const latency = Math.round(performance.now() - shownAtRef.current);

    try {
      await logExecutionEvent({
        data: {
          mission_id: manifestation.block.id,
          kind: "manifest_ack",
          phase: manifestation.phase,
          channel: source === "voice" ? "voice" : "manual",
          latency_ms: latency,
        },
      });

      if (action.kind === "done" && mission) {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) await markMissionToday(mission, u.user.id, true);
        await logExecutionEvent({
          data: { mission_id: manifestation.block.id, kind: "mission_done", channel: source === "voice" ? "voice" : "manual" },
        });
        toast.success("Feito. +XP");
      } else if (action.kind === "skip" && mission) {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) await markMissionToday(mission, u.user.id, false);
        await logExecutionEvent({
          data: { mission_id: manifestation.block.id, kind: "mission_skipped", channel: source === "voice" ? "voice" : "manual" },
        });
        toast("Bloco pulado.");
      } else if (action.kind === "extend") {
        await extendMissionToday({ data: { mission_id: manifestation.block.id, minutes: action.minutes } });
        toast.success(`+${action.minutes}min pro bloco.`);
      } else if (action.kind === "note") {
        await logExecutionEvent({
          data: { mission_id: manifestation.block.id, kind: "voice_note", channel: "voice", note: action.text },
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não deu pra registrar.");
    } finally {
      setBusy(false);
      onResolved(action);
    }
  }

  return (
    <section className="fixed inset-x-0 bottom-24 z-30 mx-auto max-w-[var(--shell-max)] px-4 lg:bottom-4">
      <div className="rounded-2xl border border-ember/50 bg-charcoal-900/95 p-4 shadow-[0_0_40px_-12px] shadow-ember/40 backdrop-blur-xl">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ember" />
          <span className="font-display text-[10px] uppercase tracking-[0.2em] text-ember">
            WiMi · {phaseLabel(manifestation.phase)}
          </span>
          <span className="ml-auto font-display text-[10px] tracking-[0.15em] text-muted-foreground">
            {manifestation.block.title}
          </span>
        </div>

        <p className="text-sm text-foreground">{manifestation.message}</p>

        {speech.supported && (speech.listening || heardText) ? (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-ember/20 bg-charcoal-800/60 p-2">
            {speech.listening ? (
              <Mic className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-pulse text-ember" />
            ) : (
              <MicOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <p className="min-w-0 flex-1 text-[12px] leading-snug text-muted-foreground">
              {speech.preview || heardText || "ouvindo…"}
            </p>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void ackAndResolve({ kind: "done" }, "click")}
            className="flex items-center gap-1 rounded-full bg-ember px-3 py-1.5 text-xs font-medium text-charcoal-900 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Feito
          </button>
          {[5, 10, 20].map((m) => (
            <button
              key={m}
              type="button"
              disabled={busy}
              onClick={() => void ackAndResolve({ kind: "extend", minutes: m }, "click")}
              className="flex items-center gap-1 rounded-full border border-ember/40 bg-ember/10 px-3 py-1.5 text-xs text-ember disabled:opacity-60"
            >
              <Plus className="h-3 w-3" />
              {m}min
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => void ackAndResolve({ kind: "skip" }, "click")}
            className="flex items-center gap-1 rounded-full border border-border bg-charcoal-800/60 px-3 py-1.5 text-xs text-muted-foreground disabled:opacity-60"
          >
            <X className="h-3 w-3" /> Pular
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onOpenAssistant}
            className="ml-auto flex items-center gap-1 rounded-full border border-border bg-charcoal-800/60 px-3 py-1.5 text-xs text-muted-foreground disabled:opacity-60"
          >
            <MessageCircle className="h-3 w-3" /> Conversar
          </button>
        </div>
      </div>
    </section>
  );
}

function phaseLabel(p: JourneyManifestation["phase"]): string {
  if (p === "preEnd") return "faltando pouco";
  if (p === "atEnd") return "no fim do bloco";
  return "começando agora";
}

async function readVoiceGender(): Promise<"feminina" | "masculina"> {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return "feminina";
    const { data: cs } = await supabase
      .from("chat_settings")
      .select("voice_gender")
      .eq("user_id", data.user.id)
      .maybeSingle();
    const g = (cs as { voice_gender?: string } | null)?.voice_gender;
    return g === "masculina" ? "masculina" : "feminina";
  } catch {
    return "feminina";
  }
}
