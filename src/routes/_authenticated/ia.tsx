import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Mic, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { MobileShell } from "@/components/shell/MobileShell";
import { supabase } from "@/integrations/supabase/client";
import { applyAuditWrite, rejectAuditWrite, undoAuditWrite } from "@/lib/ia-capture.functions";
import { useServerFn } from "@tanstack/react-start";
import type { Proposal } from "@/lib/ia-capture";

export const Route = createFileRoute("/_authenticated/ia")({
  head: () => ({
    meta: [
      { title: "IA-Coletora — Personal IA" },
      { name: "description", content: "Dump por texto/áudio. A IA organiza e registra para você." },
    ],
  }),
  component: IAPage,
});

type Msg = { role: "user" | "assistant"; content: string; proposals?: Proposal[] };

function IAPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [proposalStatus, setProposalStatus] = useState<Record<string, "applied" | "rejected" | "loading" | "reverted">>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const applyFn = useServerFn(applyAuditWrite);
  const rejectFn = useServerFn(rejectAuditWrite);
  const undoFn = useServerFn(undoAuditWrite);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  // Fila de auto-envio: seeds pendentes que aguardam token disponível.
  // Refs impedem envio duplicado se o efeito re-executar.
  const pendingSeedRef = useRef<string | null>(null);
  const pendingAutosendRef = useRef<boolean>(false);
  const lastSentRef = useRef<string | null>(null);

  const drainSeed = useCallback(() => {
    try {
      const seed = sessionStorage.getItem("ia.seed");
      const autosend = sessionStorage.getItem("ia.autosend") === "1";
      if (!seed) return;
      sessionStorage.removeItem("ia.seed");
      sessionStorage.removeItem("ia.autosend");
      pendingSeedRef.current = seed;
      pendingAutosendRef.current = autosend;
      setInput(seed);
    } catch {}
  }, []);

  // Consome ao montar e reage a novos seeds enquanto já montado
  useEffect(() => {
    drainSeed();
    const onSeed = () => drainSeed();
    const onVisible = () => { if (document.visibilityState === "visible") drainSeed(); };
    window.addEventListener("ia:seed", onSeed);
    window.addEventListener("focus", onSeed);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("ia:seed", onSeed);
      window.removeEventListener("focus", onSeed);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [drainSeed]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    if (!text.trim() || busy || !token) return;
    const next = [...messages, { role: "user" as const, content: text.trim() }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ia-capture", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: sessionId, messages: next }),
      });
      const j = (await res.json()) as { session_id?: string; text?: string; proposals?: Proposal[]; error?: string };
      if (!res.ok || j.error) throw new Error(j.error ?? "ia_error");
      if (j.session_id) setSessionId(j.session_id);
      setMessages((m) => [...m, { role: "assistant", content: j.text ?? "", proposals: j.proposals ?? [] }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao falar com a IA");
    } finally {
      setBusy(false);
    }
  }

  // Auto-envia quando token chega e há seed pendente com autosend
  useEffect(() => {
    if (!token || busy) return;
    const seed = pendingSeedRef.current;
    if (!seed || !pendingAutosendRef.current) return;
    if (lastSentRef.current === seed) return;
    lastSentRef.current = seed;
    pendingSeedRef.current = null;
    pendingAutosendRef.current = false;
    void send(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, busy, input]);


  async function approve(p: Proposal) {
    setProposalStatus((s) => ({ ...s, [p.audit_id]: "loading" }));
    try {
      await applyFn({ data: { audit_id: p.audit_id } });
      setProposalStatus((s) => ({ ...s, [p.audit_id]: "applied" }));
      toast.success("Registrado");
    } catch (e) {
      setProposalStatus((s) => ({ ...s, [p.audit_id]: "rejected" }));
      toast.error(e instanceof Error ? e.message : "Falha ao registrar");
    }
  }
  async function reject(p: Proposal) {
    setProposalStatus((s) => ({ ...s, [p.audit_id]: "loading" }));
    try {
      await rejectFn({ data: { audit_id: p.audit_id } });
      setProposalStatus((s) => ({ ...s, [p.audit_id]: "rejected" }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }
  async function undo(p: Proposal) {
    setProposalStatus((s) => ({ ...s, [p.audit_id]: "loading" }));
    try {
      await undoFn({ data: { audit_id: p.audit_id } });
      setProposalStatus((s) => ({ ...s, [p.audit_id]: "reverted" }));
      toast.success("Desfeito");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível desfazer");
      setProposalStatus((s) => ({ ...s, [p.audit_id]: "applied" }));
    }
  }

  async function toggleRecord() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        toast.message("Áudio capturado. Descreva por texto (transcrição em breve).", { description: `${(blob.size/1024).toFixed(0)}KB` });
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Microfone indisponível");
    }
  }

  return (
    <MobileShell>
      <header className="sticky top-0 z-20 border-b border-border bg-charcoal-900/85 px-4 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ember text-charcoal-900 shadow-[0_8px_24px_-6px_var(--ember)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-xl tracking-wide">IA-COLETORA</h1>
            <p className="text-[11px] text-muted-foreground">Faça um dump. Eu organizo e proponho registros.</p>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5 pb-44">
        {messages.length === 0 && (
          <div className="rounded-xl border border-border bg-charcoal-800/40 p-4 text-sm text-muted-foreground">
            <p className="font-display text-ember">DESPEJE O QUE VIVEU.</p>
            <p className="mt-2 leading-relaxed">
              "Corri 5km, comi limpo, vou meditar à noite e quero ler 30min/dia esta semana." Eu transformo em hábitos, missões, metas e rituais — você só confirma.
            </p>
          </div>
        )}

        {messages.map((m, i) => {
          const mine = m.role === "user";
          return (
            <div key={i} className={`flex flex-col ${mine ? "items-end" : "items-start"} gap-2`}>
              <div
                className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  mine ? "bg-ember/20 text-foreground" : "border border-border bg-charcoal-800/60 text-foreground"
                }`}
              >
                {mine ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none prose-p:my-1">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
              </div>
              {!mine && m.proposals && m.proposals.length > 0 && (
                <div className="w-full max-w-[88%] space-y-2">
                  {m.proposals.map((p) => {
                    const st = proposalStatus[p.audit_id] ?? (p.auto_applied ? "applied" : undefined);
                    const isAuto = p.auto_applied === true;
                    const hasError = !!p.apply_error;
                    return (
                      <div
                        key={p.audit_id}
                        className={`rounded-xl border p-3 ${
                          hasError ? "border-red-500/40 bg-red-500/5" : "border-ember/40 bg-ember/5"
                        }`}
                      >
                        <p className="font-display text-[10px] tracking-[0.18em] text-ember">
                          {p.action.toUpperCase()}
                          {isAuto && !hasError && st !== "reverted" && (
                            <span className="ml-2 rounded bg-ember/20 px-1.5 py-[1px] text-[9px] text-ember">
                              AUTO
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-sm">{p.summary}</p>
                        <pre className="mt-1 max-h-24 overflow-auto text-[10px] text-muted-foreground">
                          {JSON.stringify(p.payload, null, 0)}
                        </pre>
                        <div className="mt-2 flex gap-2">
                          {hasError ? (
                            <span className="text-xs text-red-400">
                              ✗ falhou: {p.apply_error}
                            </span>
                          ) : st === "reverted" ? (
                            <span className="text-xs text-muted-foreground">↺ desfeito</span>
                          ) : st === "applied" ? (
                            <>
                              <span className="text-xs text-ember">
                                {isAuto ? "✓ salvo automaticamente" : "✓ registrado"}
                              </span>
                              {isAuto && (
                                <button
                                  onClick={() => undo(p)}
                                  className="ml-auto rounded-md border border-border px-2 py-[2px] text-[11px] text-muted-foreground hover:text-foreground"
                                >
                                  Desfazer
                                </button>
                              )}
                            </>
                          ) : st === "rejected" ? (
                            <span className="text-xs text-muted-foreground">descartado</span>
                          ) : (
                            <>
                              <button
                                onClick={() => approve(p)}
                                disabled={st === "loading"}
                                className="flex items-center gap-1 rounded-md bg-ember px-3 py-1 text-xs text-charcoal-900 disabled:opacity-50"
                              >
                                {st === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                Confirmar
                              </button>
                              <button
                                onClick={() => reject(p)}
                                disabled={st === "loading"}
                                className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs text-muted-foreground"
                              >
                                <X className="h-3 w-3" />
                                Descartar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-border bg-charcoal-800/60 px-3 py-2 text-sm text-muted-foreground">
              <span className="inline-block animate-pulse">organizando…</span>
            </div>
          </div>
        )}
      </div>

      <div
        className="fixed inset-x-0 bottom-16 z-30 mx-auto w-full max-w-[var(--shell-max)] border-t border-border bg-charcoal-900/95 px-3 py-3 backdrop-blur-xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
      >
        <div className="flex items-end gap-2">
          <button
            onClick={toggleRecord}
            className={`flex h-[42px] w-[42px] items-center justify-center rounded-xl border transition-colors ${
              recording ? "border-ember bg-ember text-charcoal-900" : "border-border bg-charcoal-800/60 text-muted-foreground"
            }`}
            aria-label="Gravar áudio"
          >
            <Mic className="h-4 w-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Despeje aqui — texto, lista, ideia solta…"
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-charcoal-800/60 px-3 py-2 text-sm outline-none focus:border-ember"
          />
          <button
            onClick={() => send(input)}
            disabled={busy || !input.trim() || !token}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-ember text-charcoal-900 transition-opacity disabled:opacity-40"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

    </MobileShell>
  );
}
