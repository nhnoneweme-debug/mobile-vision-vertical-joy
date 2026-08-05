// D1 — AÇÃO PERSONALIZADA.
// O usuário descreve em linguagem natural (voz ou texto) o que deve acontecer
// no disparo; a IA converte em primitivas + uma mensagem composta. O plano
// aparece para revisão antes de virar parte do ação.

import { useState } from "react";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";
import { DualInput } from "./DualInput";
import { interpretCustomAction, resolveTriggerProposal } from "@/lib/triggers.functions";
import type { TriggerAction } from "@/lib/triggers";

export function CustomActionBox({
  instruction,
  plan,
  onChange,
  contextHint,
}: {
  instruction: string;
  plan: string | null;
  onChange: (next: {
    instruction: string;
    plan: string | null;
    action: TriggerAction | null;
  }) => void;
  contextHint?: string;
}) {
  const [loading, setLoading] = useState(false);

  const interpret = async () => {
    setLoading(true);
    try {
      const res = await interpretCustomAction({
        data: { text: instruction.trim(), context: contextHint },
      });
      const parsed = JSON.parse(res.parsed_json) as {
        action?: TriggerAction;
        plan?: string;
      };
      if (res.audit_id)
        void resolveTriggerProposal({ data: { audit_id: res.audit_id, status: "applied" } });
      onChange({
        instruction,
        plan: parsed.plan ?? null,
        action: parsed.action ?? null,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "A IA não conseguiu interpretar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-ember/30 bg-ember/5 p-3">
      <p className="flex items-center gap-1.5 font-display text-[10px] uppercase tracking-[0.16em] text-ember">
        <Wand2 className="h-3 w-3" /> caixa de contexto
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Descreva o que deve acontecer no disparo — falando ou escrevendo.
      </p>
      <div className="mt-2">
        <DualInput
          value={instruction}
          onChange={(v) => onChange({ instruction: v, plan, action: null })}
          rows={2}
          placeholder="ex.: se eu ficar quieto muito tempo, me chama pelo nome e pergunta se travei"
        />
      </div>
      <button
        type="button"
        disabled={loading || instruction.trim().length < 4}
        onClick={() => void interpret()}
        className="mt-2 w-full rounded-lg border border-ember/40 bg-ember/10 py-2 text-[12px] text-ember disabled:opacity-40 active:scale-95"
      >
        {loading ? "interpretando…" : "Interpretar ação"}
      </button>
      {plan ? (
        <p className="mt-2 rounded-lg border border-border bg-charcoal-950/50 p-2 text-[12px] text-foreground">
          plano de ação: {plan}
        </p>
      ) : null}
    </div>
  );
}
