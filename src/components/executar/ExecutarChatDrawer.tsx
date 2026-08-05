// Conversa lado-a-lado com a WiMi dentro do /executar.
// Bottom sheet leve — mantém timeline + relógio visíveis atrás — que faz um
// stream SSE contra /api/assistant. Sem histórico de conversas, sem tools:
// serve pra trocar recados rápidos com a WiMi enquanto o bloco atual roda,
// sem sair do palco de execução. Propostas retornadas são ignoradas aqui —
// o /assistente segue sendo o lugar de propor mudanças de estrutura.

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { clientMomentHeaders } from "@/lib/client-moment";
import { loadEffort } from "@/lib/ai-effort";
import { playAssistantTts, stopAssistantTts } from "@/lib/tts-play";
import { logExecutionEvent } from "@/lib/execution.functions";
import {
  AttachButton,
  AttachChips,
  AttachmentCards,
  releasePending,
  uploadAttachments,
  type AttachmentRef,
  type PendingAttachment,
} from "./Attachments";

type Msg = { role: "user" | "assistant"; text: string; attachments?: AttachmentRef[] };


export function ExecutarChatDrawer({
  open,
  onClose,
  seed,
  autoVoice,
  voiceGender,
}: {
  open: boolean;
  onClose: () => void;
  /** Contexto opcional injetado como primeira mensagem do usuário (ex.: bloco atual). */
  seed?: string | null;
  /** Fala a resposta da WiMi ao terminar de streamar. */
  autoVoice?: boolean;
  voiceGender?: "feminina" | "masculina";
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const seededRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Rola pro fim a cada delta.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const send = useCallback(
    async (userText: string, attachRefs?: AttachmentRef[]) => {
      const text = userText.trim();
      const attachments = attachRefs ?? [];
      if ((!text && attachments.length === 0) || busy) return;
      const label = attachments.length
        ? `${text}${text ? "\n" : ""}[anexos: ${attachments.map((a) => a.name).join(", ")}]`
        : text;
      const next: Msg[] = [
        ...messages,
        { role: "user", text, ...(attachments.length ? { attachments } : {}) },
        { role: "assistant", text: "" },
      ];
      setMessages(next);
      setInput("");
      setBusy(true);


      let token: string | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token ?? null;
      } catch {
        /* segue sem token */
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...clientMomentHeaders(),
          },
          body: JSON.stringify({
            messages: next
              .filter((m, i) => !(i === next.length - 1 && m.role === "assistant"))
              .map((m, i) => ({
                role: m.role,
                text: i === next.length - 2 && m.role === "user" ? label : m.text,
              })),

            effort: loadEffort(),
          }),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const chunk of parts) {
            const line = chunk.trim();
            if (!line.startsWith("data:")) continue;
            try {
              const evt = JSON.parse(line.slice(5).trim()) as { type: string; delta?: string };
              if (evt.type === "text" && evt.delta) {
                full += evt.delta;
                setMessages((prev) => {
                  const copy = prev.slice();
                  copy[copy.length - 1] = { role: "assistant", text: full };
                  return copy;
                });
              }
            } catch {
              /* ignora frames malformados */
            }
          }
        }

        if (autoVoice && full.trim()) {
          void playAssistantTts(full, { gender: voiceGender ?? "feminina" });
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setMessages((prev) => {
          const copy = prev.slice();
          copy[copy.length - 1] = {
            role: "assistant",
            text: "Ops, não consegui responder agora. Tenta de novo em instantes.",
          };
          return copy;
        });
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [messages, busy, autoVoice, voiceGender],
  );

  // Seed automático quando abre pela primeira vez com contexto do bloco atual.
  useEffect(() => {
    if (!open) return;
    if (!seed) return;
    if (seededRef.current === seed) return;
    seededRef.current = seed;
    void send(seed);
  }, [open, seed, send]);

  // Ao fechar: aborta stream e para áudio pra não vazar entre sessões.
  useEffect(() => {
    if (open) return;
    abortRef.current?.abort();
    stopAssistantTts();
  }, [open]);

  /** Sobe os anexos e dispara o envio — texto vazio com anexo também vale. */
  const submit = useCallback(() => {
    if (busy || uploading) return;
    const text = input;
    if (!text.trim() && pending.length === 0) return;
    if (pending.length === 0) {
      void send(text);
      return;
    }
    const list = pending;
    setUploading(true);
    void uploadAttachments(list)
      .then(async (refs) => {
        setPending([]);
        await logExecutionEvent({
          data: {
            kind: "manual_log",
            channel: "manual",
            note: (text || "anexos enviados na conversa").slice(0, 4000),
            meta: {
              source: "executar_chat",
              attachments: refs.map((r) => ({
                path: r.path,
                name: r.name,
                size: r.size,
                mime: r.mime,
                kind: r.kind,
              })),
            },
          },
        }).catch(() => {});
        void send(text, refs);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Não consegui anexar.");
      })
      .finally(() => setUploading(false));
  }, [busy, input, pending, send, uploading]);

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[var(--shell-max)] px-3 pb-3">
      <div className="flex max-h-[70dvh] flex-col overflow-hidden rounded-2xl border border-ember/40 bg-charcoal-900/95 shadow-[0_-8px_40px_-12px] shadow-ember/40 backdrop-blur-xl">
        <header className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
          <Sparkles className="h-4 w-4 text-ember" />
          <span className="font-display text-[10px] uppercase tracking-[0.2em] text-ember">
            Conversar com a WiMi · sem sair do palco
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar conversa"
            className="ml-auto grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {messages.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">
              Diga algo — a WiMi lê o que está rolando agora e responde sem tirar você da tela de
              execução.
            </p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ember px-3 py-2 text-sm text-charcoal-900"
                    : "mr-auto max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-charcoal-800/60 px-3 py-2 text-sm text-foreground"
                }
              >
                {m.text || (m.role === "assistant" && busy ? "…" : "")}
                {m.attachments ? <AttachmentCards items={m.attachments} /> : null}
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-2 border-t border-border/60 p-3"
        >
          <AttachChips
            items={pending}
            onRemove={(id) =>
              setPending((prev) => {
                const gone = prev.filter((a) => a.id === id);
                releasePending(gone);
                return prev.filter((a) => a.id !== id);
              })
            }
          />
          <div className="flex items-end gap-2">
            <AttachButton
              disabled={busy || uploading}
              onPick={(files) => setPending((prev) => [...prev, ...files])}
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Fala com a WiMi…"
              className="min-h-[40px] flex-1 resize-none rounded-xl border border-border bg-charcoal-800/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ember/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || uploading || (!input.trim() && pending.length === 0)}
              aria-label="Enviar"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ember text-charcoal-900 disabled:opacity-40"
            >
              {busy || uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
