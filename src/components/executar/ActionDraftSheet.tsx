// CAMADA 4.0 — cartão de confirmação da AÇÃO criada pela conversa.
// A IA já interpretou: aqui a pessoa só lê o rascunho e decide
// Salvar / Ajustar no Studio / Cancelar.

import { Sparkles, X } from "lucide-react";
import { actionElements, describeTrigger, type TriggerDraft } from "@/lib/triggers";
import { isBackgroundCapable } from "@/lib/action-schedule";

export type ActionDraft = TriggerDraft & { summary?: string };

export function ActionDraftSheet({
  draft,
  saving = false,
  pushOn = false,
  onSave,
  onAdjust,
  onCancel,
}: {
  draft: ActionDraft;
  saving?: boolean;
  pushOn?: boolean;
  onSave: () => void;
  onAdjust: () => void;
  onCancel: () => void;
}) {
  const background = isBackgroundCapable(draft);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal-950/70 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-[var(--shell-max,480px)] overflow-y-auto rounded-t-3xl border-t border-ember/40 bg-charcoal-900 p-5 pb-8">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-ember" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg tracking-wide">NOVA AÇÃO</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Entendi seu pedido assim. Confirma?
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onCancel}
            className="rounded-full border border-border p-1.5 text-muted-foreground active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-ember/30 bg-ember/5 p-3">
          <p className="font-display text-[10px] uppercase tracking-[0.16em] text-ember">
            rascunho da ação
          </p>
          <p className="mt-1 text-sm text-foreground">{draft.name}</p>
          {draft.summary ? (
            <p className="mt-1 text-[12px] text-muted-foreground">{draft.summary}</p>
          ) : null}
          <p className="mt-2 text-[12px] text-muted-foreground">
            {describeTrigger({
              condition: draft.condition,
              action: draft.action,
              active_window: draft.active_window,
              cooldown_seconds: draft.cooldown_seconds,
            })}
          </p>
          {actionElements(draft.action).length ? (
            <ol className="mt-2 space-y-1">
              {actionElements(draft.action).map((el, i) => (
                <li key={i} className="flex gap-2 text-[11px] text-muted-foreground">
                  <span className="font-display text-ember">{i + 1}.</span>
                  <span className="min-w-0 break-words">{el}</span>
                </li>
              ))}
            </ol>
          ) : null}

          {/* NÍVEL DE GARANTIA — honesto, sem prometer o que o navegador não entrega. */}
          <p
            className={`mt-3 rounded-lg border px-2 py-1.5 text-[11px] ${
              background && pushOn
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-border bg-charcoal-950/40 text-muted-foreground"
            }`}
          >
            {background && pushOn
              ? "avisa mesmo com o app fechado (notificação)"
              : background
                ? "anuncia com o app aberto — ative as notificações em Ações para receber com o app fechado"
                : "anuncia só com o app aberto: depende dos sinais do Live"}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="w-full rounded-xl border border-ember/40 bg-ember/10 py-2.5 text-sm text-ember disabled:opacity-40 active:scale-95"
          >
            {saving ? "salvando…" : "Salvar ação"}
          </button>
          <button
            type="button"
            onClick={onAdjust}
            className="w-full rounded-xl border border-border py-2.5 text-sm text-muted-foreground active:scale-95"
          >
            Ajustar no Studio
          </button>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 w-full py-1 text-center text-[11px] text-muted-foreground active:scale-95"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
