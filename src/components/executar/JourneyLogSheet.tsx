// LOG DE JORNADA — primeira ação proativa da WiMi.
// A WiMi mostra o que ela acha que está acontecendo e pergunta: é isso mesmo?
// O usuário confirma, corrige (falando ou escrevendo) ou adia. Tudo vira
// evento append-only em execution_events.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ClipboardList, X } from "lucide-react";
import { toast } from "sonner";
import { DualInput } from "./DualInput";
import { logExecutionEvent } from "@/lib/execution.functions";

export type JourneyLogContext = {
  sessionId: string;
  missionId: string | null;
  missionTitle: string | null;
  elapsedMin: number;
  recentTranscript: string[];
  triggerName?: string | null;
  /** pergunta contextual gerada pela WiMi (falada em voz alta quando ligada) */
  question?: string | null;
};

export function JourneyLogSheet({
  context,
  onClose,
}: {
  context: JourneyLogContext;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const qc = useQueryClient();

  const summary = [
    context.missionTitle ? `bloco: ${context.missionTitle}` : "sem bloco declarado",
    `${context.elapsedMin} min de sessão Live`,
    context.recentTranscript.length
      ? `últimas falas: ${context.recentTranscript.slice(-3).join(" · ").slice(0, 240)}`
      : "sem transcrição recente",
  ];

  const save = async (mode: "confirm" | "describe" | "decline") => {
    setSaving(true);
    try {
      await logExecutionEvent({
        data: {
          mission_id: context.missionId,
          kind: mode === "decline" ? "journey_log_declined" : "journey_log",
          channel: mode === "describe" ? "voice" : "manual",
          note:
            mode === "confirm"
              ? `contexto confirmado: ${summary.join(" | ")}`.slice(0, 4000)
              : mode === "describe"
                ? text.slice(0, 4000)
                : "adiado pelo usuário",
          meta: {
            session_id: context.sessionId,
            mode,
            elapsed_min: context.elapsedMin,
            trigger: context.triggerName ?? null,
            context_summary: summary,
          },
        },
      });
      // a Timeline de hoje e o Registro leem execution_events — refresca ambos.
      void qc.invalidateQueries({ queryKey: ["execution-log"] });
      if (mode === "decline") {
        toast("Beleza — pergunto de novo mais tarde.");
        onClose();
      } else {
        setSaved(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar o log.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal-950/70 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-[var(--shell-max,480px)] overflow-y-auto rounded-t-3xl border-t border-ember/40 bg-charcoal-900 p-5 pb-8">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-ember" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg tracking-wide">LOG DE JORNADA</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {context.question ?? "O que você está executando agora? É isso mesmo?"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="rounded-full border border-border p-1.5 text-muted-foreground active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="mt-4 space-y-1 rounded-xl border border-border bg-charcoal-950/40 p-3 text-[12px] text-muted-foreground">
          {summary.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>

        {saved ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl border border-ember/40 bg-ember/10 p-3 text-[13px] text-ember">
              Registrado. Isso fica no diário de execução de hoje.
            </p>
            <p className="text-[12px] text-muted-foreground">Quer transformar isso em plano?</p>
            <div className="flex gap-2">
              <Link
                to="/planejar"
                onClick={onClose}
                className="flex-1 rounded-xl border border-ember/40 bg-ember/10 py-2.5 text-center text-sm text-ember active:scale-95"
              >
                Abrir planejamento
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground active:scale-95"
              >
                Agora não
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4">
              <DualInput
                value={text}
                onChange={setText}
                placeholder="Corrija ou detalhe o que está rolando — fale ou escreva."
              />
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save("confirm")}
                className="w-full rounded-xl border border-ember/40 bg-ember/10 py-2.5 text-sm text-ember disabled:opacity-40 active:scale-95"
              >
                Confirmar contexto
              </button>
              <button
                type="button"
                disabled={saving || !text.trim()}
                onClick={() => void save("describe")}
                className="w-full rounded-xl border border-border py-2.5 text-sm text-foreground disabled:opacity-40 active:scale-95"
              >
                Salvar o que eu disse
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save("decline")}
                className="w-full py-2 text-[12px] text-muted-foreground active:scale-95"
              >
                Agora não
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
