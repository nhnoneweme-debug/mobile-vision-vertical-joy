import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send, Check, X, ArrowRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import { createHabit, archiveHabit, type HabitFrequency } from "@/lib/habits";
import { createMission, archiveMission, type MissionType } from "@/lib/missions";
import { createWorkoutPlan, deleteWorkoutPlan } from "@/lib/workouts.functions";
import { saveDietPlan, restoreDietPlan } from "@/lib/cozinha.functions";
import { listAssistantMessages } from "@/lib/assistant.functions";
import type { Proposal } from "@/routes/api/assistant";

export const Route = createFileRoute("/_authenticated/assistente")({
  head: () => ({ meta: [{ title: "Inteligência Digital — Personal IA" }] }),
  component: AssistantPage,
});

type ProposalMsg = {
  id: number;
  role: "proposal";
  proposal: Proposal;
  status: "pending" | "done" | "cancel";
  cta?: { to: string; label: string };
};
type Msg =
  | { id: number; role: "assistant"; text: string }
  | { id: number; role: "user"; text: string }
  | ProposalMsg;

let seq = 0;
const nid = () => ++seq;

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"]; // Dom..Sáb (bit = 1<<idx)
const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
const freqMap: Record<string, HabitFrequency> = { diario: "daily", semanal: "weekly", mensal: "monthly" };
const tipoMap: Record<string, MissionType> = { unico: "one_off", diario: "daily", semanal: "weekly" };

function AssistantPage() {
  const fnCreatePlan = useServerFn(createWorkoutPlan);
  const fnDeletePlan = useServerFn(deleteWorkoutPlan);
  const fnSaveDiet = useServerFn(saveDietPlan);
  const fnRestoreDiet = useServerFn(restoreDietPlan);
  const fnHistory = useServerFn(listAssistantMessages);

  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: nid(),
      role: "assistant",
      text: "Oi! Sou sua Inteligência Digital. Me conta o que você quer — treino, dieta, um hábito ou um compromisso. Eu pergunto o que faltar e monto uma proposta pra você confirmar.",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const undoRef = useRef<Record<number, () => Promise<void>>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
    (async () => {
      try {
        const hist = await fnHistory();
        if (hist.length) setMsgs(hist.map((h) => ({ id: nid(), role: h.role, text: h.content }) as Msg));
      } catch { /* sem histórico */ }
    })();
  }, [fnHistory]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, thinking]);

  type MsgInput = Msg extends infer T ? (T extends { id: number } ? Omit<T, "id"> : never) : never;
  function push(m: MsgInput) {
    setMsgs((prev) => [...prev, { ...(m as Msg), id: nid() }]);
  }
  function patchProposal(id: number, patch: Partial<ProposalMsg>) {
    setMsgs((prev) => prev.map((m) => (m.id === id && m.role === "proposal" ? { ...m, ...patch } : m)));
  }
  function updateData(id: number, data: Proposal["data"]) {
    setMsgs((prev) =>
      prev.map((m) =>
        m.id === id && m.role === "proposal" ? ({ ...m, proposal: { ...m.proposal, data } as Proposal }) : m,
      ),
    );
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || thinking) return;
    const convo = msgs
      .filter((m): m is Extract<Msg, { role: "user" | "assistant" }> => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, text: m.text }));
    push({ role: "user", text: t });
    setInput("");
    setThinking(true);

    // Bolha do assistente que cresce token a token (criada no 1º delta).
    let assistantId: number | null = null;
    const appendDelta = (delta: string) => {
      if (assistantId == null) {
        const idNew = nid();
        assistantId = idNew;
        setThinking(false);
        setMsgs((prev) => [...prev, { id: idNew, role: "assistant", text: delta }]);
      } else {
        const idCur = assistantId;
        setMsgs((prev) =>
          prev.map((m) =>
            m.id === idCur && m.role === "assistant" ? { ...m, text: m.text + delta } : m,
          ),
        );
      }
    };

    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ messages: [...convo, { role: "user", text: t }] }),
      });
      if (!r.ok || !r.body) throw new Error(String(r.status));

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawError = false;

      // Consome o SSE: eventos separados por linha em branco, cada um "data: {json}".
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          let evt: { type: string; delta?: string; proposals?: Proposal[] };
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          if (evt.type === "text" && evt.delta) {
            appendDelta(evt.delta);
          } else if (evt.type === "proposals") {
            for (const p of evt.proposals ?? []) push({ role: "proposal", proposal: p, status: "pending" });
          } else if (evt.type === "error") {
            sawError = true;
          }
        }
      }

      if (sawError && assistantId == null) {
        appendDelta("Tive um problema pra responder agora. Tenta de novo?");
      }
    } catch {
      if (assistantId == null) appendDelta("Tive um problema pra responder agora. Tenta de novo?");
    } finally {
      setThinking(false);
    }
  }

  async function confirm(msg: ProposalMsg) {
    if (!userId) { toast.error("Faça login."); return; }
    const p = msg.proposal;
    try {
      if (p.kind === "habito") {
        const h = await createHabit(userId, {
          title: p.data.titulo,
          frequency: freqMap[p.data.frequencia] ?? "weekly",
          target: p.data.meta ?? 1,
          area_slug: p.data.area,
        });
        undoRef.current[msg.id] = async () => { await archiveHabit(h.id); };
        patchProposal(msg.id, { status: "done", cta: { to: "/home", label: "Ver na Home" } });
      } else if (p.kind === "compromisso") {
        const mask = (p.data.dias_semana ?? []).reduce((acc, d) => acc | (1 << d), 0);
        const type: MissionType = p.data.tipo ? tipoMap[p.data.tipo] : mask ? "weekly" : "one_off";
        const m = await createMission(userId, {
          title: p.data.titulo,
          mission_type: type,
          scheduled_time: p.data.horario_inicio ?? null,
          end_time: p.data.horario_fim ?? null,
          weekday_mask: mask || 127,
        });
        undoRef.current[msg.id] = async () => { await archiveMission(m.id); };
        patchProposal(msg.id, { status: "done", cta: { to: "/agenda", label: "Ver na Agenda" } });
      } else if (p.kind === "treino") {
        const days = p.data.dias.map((d) => ({
          id: uid(),
          dia: d.dia,
          foco: d.foco,
          exercicios: d.exercicios.map((e) => ({ id: uid(), nome: e.nome, series: e.series, reps: e.reps })),
        }));
        const plan = await fnCreatePlan({ data: { name: p.data.nome, days, source: "ai" } });
        undoRef.current[msg.id] = async () => { await fnDeletePlan({ data: { id: plan.id } }); };
        patchProposal(msg.id, { status: "done", cta: { to: "/treino", label: "Ver no Treino" } });
      } else {
        const meals = p.data.refeicoes.map((r) => ({ time: r.horario, name: r.nome, items: r.itens }));
        const { previous } = await fnSaveDiet({ data: { name: p.data.nome, hydration_ml: p.data.hidratacao_ml, meals } });
        undoRef.current[msg.id] = async () => { await fnRestoreDiet({ data: { plan: previous } }); };
        patchProposal(msg.id, { status: "done", cta: { to: "/area/cozinha", label: "Ver na Dieta" } });
      }
      toast.success("Criado com sucesso.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui criar. Tenta de novo.");
    }
  }

  async function undo(msg: ProposalMsg) {
    const fn = undoRef.current[msg.id];
    if (!fn) return;
    try {
      await fn();
      delete undoRef.current[msg.id];
      patchProposal(msg.id, { status: "cancel", cta: undefined });
      toast("Desfeito.");
    } catch {
      toast.error("Não consegui desfazer.");
    }
  }

  function cancel(msg: ProposalMsg) {
    patchProposal(msg.id, { status: "cancel" });
    push({ role: "assistant", text: "Sem problema. Quer ajustar o pedido? É só me falar." });
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
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl leading-none tracking-wide text-foreground">INTELIGÊNCIA DIGITAL</h1>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">Conversa, entende e propõe — você confirma</p>
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
                  <p className="whitespace-pre-wrap text-sm leading-snug text-foreground">{m.text}</p>
                </div>
              </div>
            );
          }
          return (
            <ProposalCard
              key={m.id}
              msg={m}
              onChange={(d) => updateData(m.id, d)}
              onConfirm={() => confirm(m)}
              onCancel={() => cancel(m)}
              onUndo={() => undo(m)}
            />
          );
        })}
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

      <div
        className="fixed inset-x-0 bottom-0 z-40 mx-auto border-t border-border bg-charcoal-900/95 px-3 pb-6 pt-2.5 backdrop-blur-xl"
        style={{ maxWidth: "var(--shell-max)" }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1}
            placeholder="Fala comigo…"
            className="max-h-28 flex-1 resize-none rounded-xl border border-input bg-charcoal-800 px-3 py-2.5 text-foreground outline-none placeholder:text-muted-foreground focus:border-ember/60"
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={!input.trim() || thinking}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ember text-charcoal-900 disabled:opacity-40 active:scale-95"
            aria-label="Enviar"
          >
            <Send className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </MobileShell>
  );
}

/* ---------- Card de proposta (editável em tempo real) ---------- */
function ProposalCard({
  msg, onChange, onConfirm, onCancel, onUndo,
}: {
  msg: ProposalMsg;
  onChange: (d: Proposal["data"]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onUndo: () => void;
}) {
  const p = msg.proposal;
  const label = p.kind === "habito" ? "HÁBITO" : p.kind === "compromisso" ? "COMPROMISSO" : p.kind === "treino" ? "TREINO" : "DIETA";

  return (
    <div className="flex justify-start">
      <div className="forge-raised w-full max-w-[92%] rounded-2xl border border-ember/30 bg-charcoal-800 p-3.5">
        <p className="mb-2 font-display text-[10px] tracking-[0.3em] text-ember">PROPOSTA · {label}</p>

        {msg.status === "pending" ? (
          <>
            {p.kind === "habito" && <HabitEditor data={p.data} onChange={onChange as (d: typeof p.data) => void} />}
            {p.kind === "compromisso" && <CommitmentEditor data={p.data} onChange={onChange as (d: typeof p.data) => void} />}
            {p.kind === "treino" && <TreinoEditor data={p.data} onChange={onChange as (d: typeof p.data) => void} />}
            {p.kind === "dieta" && <DietEditor data={p.data} onChange={onChange as (d: typeof p.data) => void} />}

            <div className="mt-3 flex gap-2">
              <button type="button" onClick={onConfirm} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ember py-2.5 font-display text-sm tracking-wide text-charcoal-900 active:scale-[0.99]">
                <Check className="h-4 w-4" strokeWidth={3} /> Confirmar
              </button>
              <button type="button" onClick={onCancel} className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-charcoal-900 px-3.5 py-2.5 font-display text-sm text-muted-foreground active:scale-[0.99]">
                <X className="h-4 w-4" /> Cancelar
              </button>
            </div>
          </>
        ) : msg.status === "done" ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-display text-[11px] tracking-[0.2em] text-ember">✓ CRIADO</span>
              {msg.cta && (
                <Link to={msg.cta.to} className="inline-flex items-center gap-1 font-display text-[11px] tracking-[0.15em] text-muted-foreground">
                  {msg.cta.label.toUpperCase()} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
            <button type="button" onClick={onUndo} className="flex items-center gap-1 text-[11px] tracking-[0.2em] text-muted-foreground active:text-destructive">
              <RotateCcw className="h-3.5 w-3.5" /> DESFAZER
            </button>
          </div>
        ) : (
          <p className="font-display text-[11px] tracking-[0.2em] text-muted-foreground">CANCELADO</p>
        )}
      </div>
    </div>
  );
}

const fieldCls = "w-full rounded-lg border border-border bg-charcoal-900 px-2.5 py-2 text-sm text-foreground focus:border-ember/60 focus:outline-none";

function HabitEditor({ data, onChange }: { data: Extract<Proposal, { kind: "habito" }>["data"]; onChange: (d: Extract<Proposal, { kind: "habito" }>["data"]) => void }) {
  return (
    <div className="space-y-2">
      <input className={fieldCls} value={data.titulo} onChange={(e) => onChange({ ...data, titulo: e.target.value })} placeholder="Título do hábito" />
      <div className="flex gap-2">
        <select className={fieldCls} value={data.frequencia} onChange={(e) => onChange({ ...data, frequencia: e.target.value as typeof data.frequencia })}>
          <option value="diario">Diário</option>
          <option value="semanal">Semanal</option>
          <option value="mensal">Mensal</option>
        </select>
        <input type="number" min={1} className={fieldCls + " w-24"} value={data.meta ?? 1} onChange={(e) => onChange({ ...data, meta: Number(e.target.value) || 1 })} aria-label="meta" />
      </div>
    </div>
  );
}

function CommitmentEditor({ data, onChange }: { data: Extract<Proposal, { kind: "compromisso" }>["data"]; onChange: (d: Extract<Proposal, { kind: "compromisso" }>["data"]) => void }) {
  const dias = data.dias_semana ?? [];
  const toggle = (i: number) => {
    const next = dias.includes(i) ? dias.filter((d) => d !== i) : [...dias, i].sort();
    onChange({ ...data, dias_semana: next });
  };
  return (
    <div className="space-y-2">
      <input className={fieldCls} value={data.titulo} onChange={(e) => onChange({ ...data, titulo: e.target.value })} placeholder="Título" />
      <div className="flex gap-1">
        {DIAS.map((d, i) => (
          <button key={i} type="button" onClick={() => toggle(i)}
            className={"grid h-8 flex-1 place-items-center rounded-lg border font-display text-xs " + (dias.includes(i) ? "border-ember bg-ember/15 text-ember" : "border-border text-muted-foreground")}>
            {d}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="time" className={fieldCls} value={data.horario_inicio ?? ""} onChange={(e) => onChange({ ...data, horario_inicio: e.target.value })} aria-label="início" />
        <input type="time" className={fieldCls} value={data.horario_fim ?? ""} onChange={(e) => onChange({ ...data, horario_fim: e.target.value })} aria-label="fim" />
      </div>
    </div>
  );
}

function TreinoEditor({ data, onChange }: { data: Extract<Proposal, { kind: "treino" }>["data"]; onChange: (d: Extract<Proposal, { kind: "treino" }>["data"]) => void }) {
  return (
    <div className="space-y-2">
      <input className={fieldCls} value={data.nome} onChange={(e) => onChange({ ...data, nome: e.target.value })} placeholder="Nome do treino" />
      {data.dias.map((dia, di) => (
        <div key={di} className="rounded-lg border border-border bg-charcoal-900 p-2">
          <div className="mb-1 flex gap-2">
            <input className={fieldCls + " w-20"} value={dia.dia} onChange={(e) => { const dias = [...data.dias]; dias[di] = { ...dia, dia: e.target.value }; onChange({ ...data, dias }); }} />
            <input className={fieldCls} value={dia.foco ?? ""} placeholder="foco" onChange={(e) => { const dias = [...data.dias]; dias[di] = { ...dia, foco: e.target.value }; onChange({ ...data, dias }); }} />
          </div>
          {dia.exercicios.map((ex, ei) => (
            <div key={ei} className="mt-1 flex gap-1">
              <input className={fieldCls} value={ex.nome} onChange={(e) => { const dias = [...data.dias]; const exs = [...dia.exercicios]; exs[ei] = { ...ex, nome: e.target.value }; dias[di] = { ...dia, exercicios: exs }; onChange({ ...data, dias }); }} />
              <input type="number" className={fieldCls + " w-12"} value={ex.series ?? 3} onChange={(e) => { const dias = [...data.dias]; const exs = [...dia.exercicios]; exs[ei] = { ...ex, series: Number(e.target.value) || 0 }; dias[di] = { ...dia, exercicios: exs }; onChange({ ...data, dias }); }} aria-label="séries" />
              <input className={fieldCls + " w-16"} value={ex.reps ?? ""} placeholder="reps" onChange={(e) => { const dias = [...data.dias]; const exs = [...dia.exercicios]; exs[ei] = { ...ex, reps: e.target.value }; dias[di] = { ...dia, exercicios: exs }; onChange({ ...data, dias }); }} />
              <button type="button" onClick={() => { const dias = [...data.dias]; dias[di] = { ...dia, exercicios: dia.exercicios.filter((_, x) => x !== ei) }; onChange({ ...data, dias }); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DietEditor({ data, onChange }: { data: Extract<Proposal, { kind: "dieta" }>["data"]; onChange: (d: Extract<Proposal, { kind: "dieta" }>["data"]) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className={fieldCls} value={data.nome ?? ""} placeholder="Nome da dieta" onChange={(e) => onChange({ ...data, nome: e.target.value })} />
        <input type="number" className={fieldCls + " w-28"} value={data.hidratacao_ml ?? 0} placeholder="água (ml)" onChange={(e) => onChange({ ...data, hidratacao_ml: Number(e.target.value) || 0 })} aria-label="hidratação ml" />
      </div>
      {data.refeicoes.map((r, ri) => (
        <div key={ri} className="rounded-lg border border-border bg-charcoal-900 p-2">
          <div className="mb-1 flex gap-2">
            <input className={fieldCls + " w-20"} value={r.horario ?? ""} placeholder="hora" onChange={(e) => { const rs = [...data.refeicoes]; rs[ri] = { ...r, horario: e.target.value }; onChange({ ...data, refeicoes: rs }); }} />
            <input className={fieldCls} value={r.nome} onChange={(e) => { const rs = [...data.refeicoes]; rs[ri] = { ...r, nome: e.target.value }; onChange({ ...data, refeicoes: rs }); }} />
          </div>
          <textarea
            className={fieldCls}
            rows={2}
            value={r.itens.join(", ")}
            placeholder="itens separados por vírgula"
            onChange={(e) => { const rs = [...data.refeicoes]; rs[ri] = { ...r, itens: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }; onChange({ ...data, refeicoes: rs }); }}
          />
        </div>
      ))}
    </div>
  );
}
