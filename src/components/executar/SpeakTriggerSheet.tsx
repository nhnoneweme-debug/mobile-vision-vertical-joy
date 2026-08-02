// D2 — CRIAR GATILHO FALANDO / MODO RÁPIDO.
// O usuário descreve o gatilho inteiro (voz ou texto), a IA monta o rascunho
// estruturado e mostra um resumo legível. No modo rápido dá pra salvar direto
// (ou abrir no builder para ajustar). Sem `onSave`, só o caminho do builder.

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { DualInput } from "./DualInput";
import { interpretTriggerSpeech, resolveTriggerProposal } from "@/lib/triggers.functions";
import { actionElements, describeTrigger, type TriggerDraft } from "@/lib/triggers";

type Interpreted = TriggerDraft & { summary?: string };

export function SpeakTriggerSheet({
  onClose,
  onUse,
  onSave,
  saving = false,
}: {
  onClose: () => void;
  onUse: (draft: Interpreted) => void;
  /** Modo rápido: salva o gatilho direto, sem passar pelo builder. */
  onSave?: (draft: Interpreted) => void;
  saving?: boolean;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Interpreted | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);

  const interpret = async () => {
    setLoading(true);
    try {
      const res = await interpretTriggerSpeech({ data: { text: text.trim() } });
      const parsed = JSON.parse(res.draft_json) as Record<string, unknown>;
      setAuditId(res.audit_id);
      setDraft({
        name: String(parsed.name ?? "novo gatilho"),
        enabled: true,
        trigger_type: parsed.trigger_type === "chronos" ? "chronos" : "event",
        condition: parsed.condition as Interpreted["condition"],
        action: (parsed.action ?? {}) as Interpreted["action"],
        active_window: (parsed.active_window ?? {}) as Interpreted["active_window"],
        cooldown_seconds: Number(parsed.cooldown_seconds ?? 30),
        summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "A IA não conseguiu interpretar.");
    } finally {
      setLoading(false);
    }
  };

  const discard = () => {
    if (auditId) void resolveTriggerProposal({ data: { audit_id: auditId, status: "rejected" } });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal-950/70 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-[var(--shell-max,480px)] overflow-y-auto rounded-t-3xl border-t border-ember/40 bg-charcoal-900 p-5 pb-8">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-ember" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg tracking-wide">CRIAR FALANDO</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Descreva o gatilho inteiro. Ex.: "todo dia às 14h me lembra de beber água com um
              sino".
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={discard}
            className="rounded-full border border-border p-1.5 text-muted-foreground active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          <DualInput value={text} onChange={setText} placeholder="Fale ou escreva o gatilho…" />
        </div>

        <button
          type="button"
          disabled={loading || text.trim().length < 4}
          onClick={() => void interpret()}
          className="mt-3 w-full rounded-xl border border-ember/40 bg-ember/10 py-2.5 text-sm text-ember disabled:opacity-40 active:scale-95"
        >
          {loading ? "interpretando…" : "Interpretar com a WiMi"}
        </button>

        {draft ? (
          <div className="mt-4 rounded-xl border border-ember/30 bg-ember/5 p-3">
            <p className="font-display text-[10px] uppercase tracking-[0.16em] text-ember">
              rascunho interpretado
            </p>
            <p className="mt-1 text-sm text-foreground">{draft.name}</p>
            {draft.summary ? (
              <p className="mt-1 text-[12px] text-muted-foreground">{draft.summary}</p>
            ) : null}
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-charcoal-950/60 p-2 text-[10px] text-muted-foreground">
              {JSON.stringify(
                {
                  condition: draft.condition,
                  action: draft.action,
                  active_window: draft.active_window,
                  cooldown_seconds: draft.cooldown_seconds,
                },
                null,
                1,
              )}
            </pre>
            <button
              type="button"
              onClick={() => {
                if (auditId)
                  void resolveTriggerProposal({ data: { audit_id: auditId, status: "applied" } });
                onUse(draft);
              }}
              className="mt-3 w-full rounded-xl border border-ember/40 bg-ember/10 py-2.5 text-sm text-ember active:scale-95"
            >
              Revisar no builder
            </button>
            <p className="mt-1 text-center text-[10px] text-muted-foreground">
              nada é salvo antes da sua revisão
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
