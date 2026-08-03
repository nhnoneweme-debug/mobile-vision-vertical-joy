// CONVERSAR SOBRE A SESSÃO — Interação Livre já carregada com o conteúdo
// coletado (transcrição da sessão, registros e logs de jornada do dia).
// Cada entrada e cada resposta viram um evento dialog_turn na timeline.

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, Send, X } from "lucide-react";
import { toast } from "sonner";
import { DualInput } from "./DualInput";
import { liveSessionChat } from "@/lib/live-dialog.functions";
import { logExecutionEvent } from "@/lib/execution.functions";

export type SessionTalkContext = {
  sessionId: string;
  missionId: string | null;
  /** transcrição + registros da sessão, já em texto */
  content: string;
  /** pergunta inicial (quando aberto por código de voz) */
  initialQuestion?: string | null;
};

type Turn = { role: "user" | "assistant"; text: string };

export function SessionTalkSheet({
  context,
  onSpeak,
  onClose,
}: {
  context: SessionTalkContext;
  onSpeak?: (text: string) => void;
  onClose: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentInitial = useRef(false);

  const log = useCallback(
    (role: "user" | "assistant", note: string) =>
      logExecutionEvent({
        data: {
          mission_id: context.missionId,
          kind: "dialog_turn",
          channel: role === "user" ? "voice" : "foreground",
          note: note.slice(0, 4000),
          meta: { session_id: context.sessionId, role, source: "session_talk" },
        },
      }).catch(() => {}),
    [context.missionId, context.sessionId],
  );

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || busy) return;
      setText("");
      setTurns((prev) => [...prev, { role: "user", text: q }]);
      void log("user", q);
      setBusy(true);
      try {
        const historyRef = turns.slice(-10);
        const res = await liveSessionChat({
          data: {
            session_context: context.content.slice(0, 12000),
            history: historyRef,
            question: q,
          },
        });
        setTurns((prev) => [...prev, { role: "assistant", text: res.message }]);
        void log("assistant", res.message);
        onSpeak?.(res.message);
        void qc.invalidateQueries({ queryKey: ["execution-log"] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao conversar sobre a sessão.");
      } finally {
        setBusy(false);
      }
    },
    [busy, context.content, log, onSpeak, qc, turns],
  );

  useEffect(() => {
    if (sentInitial.current || !context.initialQuestion) return;
    sentInitial.current = true;
    void ask(context.initialQuestion);
  }, [ask, context.initialQuestion]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal-950/80 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl border border-border bg-charcoal-900 p-4 sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <MessagesSquare className="h-3.5 w-3.5" /> Conversar sobre a sessão
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full border border-border p-2 text-muted-foreground active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          Contexto carregado: {context.content ? `${context.content.length} caracteres` : "vazio"}{" "}
          de transcrição e registros desta sessão.
        </p>

        <div ref={listRef} className="mt-3 min-h-[96px] flex-1 space-y-2 overflow-y-auto pr-1">
          {turns.length === 0 && !busy ? (
            <p className="text-[13px] text-muted-foreground">
              Pergunte o que quiser sobre o que foi dito: resumo, o que você falou sobre um tema,
              tarefas que saíram daí, ou transformar tudo em um plano.
            </p>
          ) : null}
          {turns.map((t, i) => (
            <p
              key={`${i}-${t.role}`}
              className={`rounded-xl px-3 py-2 text-[13px] leading-relaxed ${
                t.role === "user"
                  ? "bg-charcoal-950/60 text-foreground"
                  : "border border-ember/30 bg-ember/5 text-foreground"
              }`}
            >
              {t.text}
            </p>
          ))}
          {busy ? <p className="text-[12px] text-ember">WiMi está lendo a sessão…</p> : null}
        </div>

        <div className="mt-3">
          <DualInput value={text} onChange={setText} placeholder="Pergunte sobre a sessão…" />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy || !text.trim()}
              onClick={() => void ask(text)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-ember/40 bg-ember/10 py-2.5 text-sm text-ember disabled:opacity-40 active:scale-95"
            >
              <Send className="h-4 w-4" /> Perguntar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void ask("Resuma a sessão e extraia as tarefas que surgiram.")}
              className="rounded-xl border border-border px-3 py-2.5 text-[12px] text-muted-foreground disabled:opacity-40 active:scale-95"
            >
              Resumir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
