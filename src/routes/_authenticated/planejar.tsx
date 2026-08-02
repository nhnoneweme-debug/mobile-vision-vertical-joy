// Framework Planejar — chat especializado que gera blocos de execução.
// Reusa /api/assistant como backend (mesma "memória" e histórico de conversa
// não são persistidos aqui — cada sessão é um plano). Quando a WiMi retorna
// um code fence ```plan {...}```, renderiza o PlanBlocksCard editável.

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Compass, Loader2, Send } from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";
import { supabase } from "@/integrations/supabase/client";
import { clientMomentHeaders } from "@/lib/client-moment";
import { loadEffort } from "@/lib/ai-effort";
import { buildSharedContext, extractPlanBlocks, seedForFramework } from "@/lib/wimi-memory";
import { PlanBlocksCard } from "@/components/planejar/PlanBlocksCard";

type Msg = { role: "user" | "assistant"; text: string };

export const Route = createFileRoute("/_authenticated/planejar")({
  head: () => ({
    meta: [
      { title: "Planejar — WiMi" },
      {
        name: "description",
        content: "Estruture blocos de execução com a WiMi e envie direto pro palco.",
      },
    ],
  }),
  component: PlanejarPage,
});

function PlanejarPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const send = useCallback(
    async (userText: string, opts?: { hidden?: boolean }) => {
      const text = userText.trim();
      if (!text || busy) return;
      const visible: Msg[] = opts?.hidden
        ? [...messages, { role: "assistant", text: "" }]
        : [...messages, { role: "user", text }, { role: "assistant", text: "" }];
      // O que vai pro modelo inclui a mensagem do usuário sempre (mesmo escondida).
      const forModel: Msg[] = opts?.hidden
        ? [...messages, { role: "user", text }]
        : [...messages, { role: "user", text }];

      setMessages(visible);
      if (!opts?.hidden) setInput("");
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
            messages: forModel.map((m) => ({ role: m.role, text: m.text })),
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
              /* frames malformados */
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setMessages((prev) => {
          const copy = prev.slice();
          copy[copy.length - 1] = {
            role: "assistant",
            text: "Ops, não consegui responder agora. Tenta de novo.",
          };
          return copy;
        });
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [messages, busy],
  );

  // Seed único quando abre: contexto + instrução de modo planejar.
  useEffect(() => {
    if (seeded) return;
    setSeeded(true);
    (async () => {
      const ctx = await buildSharedContext("planejar");
      await send(seedForFramework(ctx), { hidden: true });
    })();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded]);

  return (
    <MobileShell>
      <header className="sticky top-0 z-20 border-b border-border bg-charcoal-900/85 px-4 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Compass className="h-5 w-5 shrink-0 text-ember" />
          <div className="min-w-0">
            <h1 className="font-display text-xl tracking-wide">PLANEJAR</h1>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Estruture blocos e envie pro palco de execução
            </p>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="space-y-3 px-4 py-5 pb-40">
        {messages.length === 0 || (messages.length === 1 && messages[0].role === "assistant" && !messages[0].text) ? (
          <p className="rounded-2xl border border-border bg-charcoal-900/60 p-3 text-[12px] text-muted-foreground">
            Diga o que precisa acontecer nas próximas horas — a WiMi vai propor blocos com
            horário, área e nome. Você edita e envia pro Executando.
          </p>
        ) : null}
        {messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ember px-3 py-2 text-sm text-charcoal-900">
                {m.text}
              </div>
            );
          }
          const blocks = m.text ? extractPlanBlocks(m.text) : null;
          const visibleText = m.text.replace(/```plan[\s\S]*?```/gi, "").trim();
          return (
            <div key={i} className="mr-auto max-w-[95%]">
              {visibleText ? (
                <div className="rounded-2xl rounded-bl-md border border-border bg-charcoal-800/60 px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
                  {visibleText || (busy && i === messages.length - 1 ? "…" : "")}
                </div>
              ) : busy && i === messages.length - 1 ? (
                <div className="rounded-2xl rounded-bl-md border border-border bg-charcoal-800/60 px-3 py-2 text-sm text-muted-foreground">
                  …
                </div>
              ) : null}
              {blocks ? <PlanBlocksCard blocks={blocks} /> : null}
            </div>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[var(--shell-max)] border-t border-border bg-charcoal-900/95 p-3 backdrop-blur-xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder="Ex.: preciso encaixar treino, almoço e 2h de estudo…"
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-charcoal-800/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ember/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Enviar"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ember text-charcoal-900 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </MobileShell>
  );
}
