import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Mic, Paperclip, Check, X, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import { parseIntent, applyProposal, type Proposal } from "@/lib/assistant-intent";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assistente")({
  head: () => ({ meta: [{ title: "Inteligência Digital — Personal IA" }] }),
  component: AssistantPage,
});

type Msg =
  | { id: number; role: "assistant"; text: string; cta?: { to: string; label: string } }
  | { id: number; role: "user"; text: string }
  | { id: number; role: "proposal"; text: string; proposal: Proposal; status: "pending" | "done" | "cancel" };

// Omit que distribui sobre a união (Omit normal colapsaria os variantes).
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

const EXAMPLES = [
  "criar hábito beber 2L de água todo dia",
  "compromisso treino segunda e quarta às 18h",
  "adicionar hábito ler 10 páginas 5x por semana",
  "agendar reunião amanhã às 14h",
];

let seq = 0;
const nid = () => ++seq;

function AssistantPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: nid(),
      role: "assistant",
      text:
        "Oi! Sou sua Inteligência Digital. Pode falar comigo à vontade — e quando quiser criar um hábito ou um compromisso, é só pedir que eu monto e confirmo com você.",
    },
  ]);
  const [input, setInput] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  function push(m: DistributiveOmit<Msg, "id">) {
    setMsgs((prev) => [...prev, { ...(m as Msg), id: nid() }]);
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || thinking) return;
    // histórico de conversa ANTES de adicionar o novo turno (msgs ainda é o valor atual)
    const history = msgs
      .filter((m): m is Extract<Msg, { role: "user" | "assistant" }> =>
        m.role === "user" || m.role === "assistant",
      )
      .map((m) => ({ role: m.role, text: m.text }));
    push({ role: "user", text: t });
    setInput("");

    // Comando explícito → proposta (cria hábito/compromisso).
    const res = parseIntent(t);
    if (res.ok) {
      setTimeout(
        () => push({ role: "proposal", text: res.summary, proposal: res.proposal, status: "pending" }),
        200,
      );
      return;
    }

    // Conversa livre → LLM (OpenAI).
    setThinking(true);
    try {
      const r = await fetch("/api/converse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: [...history, { role: "user", text: t }] }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const data = (await r.json()) as { text?: string };
      push({ role: "assistant", text: data.text?.trim() || "…" });
    } catch {
      push({
        role: "assistant",
        text: "Tive um problema para responder agora. Tenta de novo em instantes?",
      });
    } finally {
      setThinking(false);
    }
  }

  async function confirm(id: number, proposal: Proposal) {
    if (!userId) return;
    try {
      const msg = await applyProposal(userId, proposal);
      setMsgs((prev) =>
        prev.map((m) => (m.id === id && m.role === "proposal" ? { ...m, status: "done" } : m)),
      );
      push({
        role: "assistant",
        text: msg,
        cta: proposal.kind === "habit" ? { to: "/home", label: "Ver na Home" } : { to: "/agenda", label: "Ver na Agenda" },
      });
      toast.success("Criado com sucesso");
    } catch {
      toast.error("Não consegui salvar. Tente de novo.");
    }
  }

  function cancel(id: number) {
    setMsgs((prev) =>
      prev.map((m) => (m.id === id && m.role === "proposal" ? { ...m, status: "cancel" } : m)),
    );
    push({ role: "assistant", text: "Sem problema, cancelei. Quer ajustar o pedido?" });
  }

  return (
    <MobileShell>
      <header
        className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-charcoal-900/85 pb-3 pl-14 pr-4 pt-5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <span className="ember-glow grid h-10 w-10 place-items-center rounded-2xl bg-charcoal-800 text-ember">
          <Sparkles className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div>
          <h1 className="font-display text-xl leading-none tracking-wide text-foreground">INTELIGÊNCIA DIGITAL</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Cria hábitos e compromissos sob comando</p>
        </div>
      </header>

      <div className="space-y-3 px-4 pt-4">
        {msgs.map((m) => {
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[82%] rounded-2xl rounded-br-md bg-ember px-3.5 py-2.5 text-charcoal-900">
                  <p className="text-sm leading-snug">{m.text}</p>
                </div>
              </div>
            );
          }
          if (m.role === "assistant") {
            return (
              <div key={m.id} className="flex justify-start">
                <div className="forge-card max-w-[86%] rounded-2xl rounded-bl-md px-3.5 py-2.5">
                  <p className="text-sm leading-snug text-foreground">{m.text}</p>
                  {m.cta && (
                    <Link
                      to={m.cta.to}
                      className="mt-2 inline-flex items-center gap-1 font-display text-[11px] tracking-[0.2em] text-ember"
                    >
                      {m.cta.label.toUpperCase()} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          }
          // proposal
          return (
            <div key={m.id} className="flex justify-start">
              <div className="forge-raised max-w-[90%] rounded-2xl border border-ember/30 bg-charcoal-800 p-3.5">
                <p className="font-display text-[10px] tracking-[0.3em] text-ember">PROPOSTA</p>
                <p className="mt-1 text-sm leading-snug text-foreground">{m.text}</p>
                {m.status === "pending" ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => confirm(m.id, m.proposal)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ember py-2.5 font-display text-sm tracking-wide text-charcoal-900 active:scale-[0.99]"
                    >
                      <Check className="h-4 w-4" strokeWidth={3} /> Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => cancel(m.id)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-charcoal-900 px-3.5 py-2.5 font-display text-sm text-muted-foreground active:scale-[0.99]"
                    >
                      <X className="h-4 w-4" /> Ajustar
                    </button>
                  </div>
                ) : (
                  <p className={"mt-2 font-display text-[11px] tracking-[0.2em] " + (m.status === "done" ? "text-ember" : "text-muted-foreground")}>
                    {m.status === "done" ? "✓ CRIADO" : "CANCELADO"}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {msgs.length <= 1 && (
          <div className="pt-1">
            <p className="mb-2 font-display text-[10px] tracking-[0.3em] text-muted-foreground">EXEMPLOS</p>
            <div className="flex flex-col gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => send(ex)}
                  className="forge-press rounded-xl border border-border bg-charcoal-900 px-3 py-2 text-left text-sm text-foreground active:forge-press-active"
                >
                  “{ex}”
                </button>
              ))}
            </div>
          </div>
        )}
        {thinking && (
          <div className="flex justify-start">
            <div className="forge-card rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm italic text-muted-foreground">
              pensando…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="h-28" />

      {/* Barra de entrada fixa */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 mx-auto border-t border-border bg-charcoal-900/95 px-3 pb-6 pt-2.5 backdrop-blur-xl"
        style={{ maxWidth: "var(--shell-max)" }}
      >
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => toast("Anexos ficam disponíveis com o backend real 🙂")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-charcoal-800 text-muted-foreground"
            aria-label="Anexar arquivo"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
            rows={1}
            placeholder="Inserir texto…"
            className="max-h-28 flex-1 resize-none rounded-xl border border-input bg-charcoal-800 px-3 py-2.5 text-foreground outline-none placeholder:text-muted-foreground focus:border-ember/60"
          />
          {input.trim() ? (
            <button
              type="button"
              onClick={() => send(input)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ember text-charcoal-900 active:scale-95"
              aria-label="Enviar"
            >
              <Send className="h-5 w-5" strokeWidth={2.4} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => toast("Gravação de áudio fica disponível com o backend real 🙂")}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-charcoal-800 text-muted-foreground"
              aria-label="Gravar áudio"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
