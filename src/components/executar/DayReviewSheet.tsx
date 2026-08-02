// REGISTRAR MEU DIA — o ritual da noite, ancorado no que a timeline capturou.
//
// Não duplica o "Fechar o Dia" (DumpChat em /dormir): aqui a WiMi mostra os
// registros do dia e pergunta o que faltou / como foi de verdade, salvando um
// evento `day_review`. Quem quiser conversar mais fundo segue pro /dormir,
// que continua sendo o companion noturno existente.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Loader2, MoonStar, X } from "lucide-react";
import { toast } from "sonner";
import { DualInput } from "./DualInput";
import { logExecutionEvent } from "@/lib/execution.functions";

export type DayReviewEntry = { time: string; label: string };

export function DayReviewSheet({
  entries,
  onClose,
}: {
  entries: DayReviewEntry[];
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const qc = useQueryClient();

  async function save() {
    const body = text.trim();
    if (!body) {
      toast.info("Conta como foi o dia — fale ou escreva.");
      return;
    }
    setSaving(true);
    try {
      await logExecutionEvent({
        data: {
          kind: "day_review",
          channel: "manual",
          note: body.slice(0, 4000),
          meta: {
            mode: "night",
            day: new Date().toISOString().slice(0, 10),
            anchored_on: entries.map((e) => `${e.time} ${e.label}`).slice(0, 40),
          },
        },
      });
      void qc.invalidateQueries({ queryKey: ["execution-log"] });
      setSaved(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui salvar o registro do dia.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal-950/70 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-[var(--shell-max,480px)] overflow-y-auto rounded-t-3xl border-t border-ember/40 bg-charcoal-900 p-5 pb-8">
        <div className="flex items-start gap-3">
          <MoonStar className="mt-0.5 h-5 w-5 shrink-0 text-ember" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg tracking-wide">REGISTRAR MEU DIA</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Pra estarmos na mesma página quando falarmos do dia: isto é o que eu registrei. O que
              faltou? O que foi de verdade?
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="shrink-0 rounded-full border border-border p-1.5 text-muted-foreground active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-border bg-charcoal-950/40 p-3">
          {entries.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">
              Hoje não registrei nada — então me conta você: como foi?
            </p>
          ) : (
            <ul className="space-y-1 text-[12px] text-muted-foreground">
              {entries.map((e) => (
                <li key={`${e.time}-${e.label}`} className="truncate">
                  <span className="tabular-nums text-ember">{e.time}</span> · {e.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {saved ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl border border-ember/40 bg-ember/10 p-3 text-[13px] text-ember">
              Registrado. Amanhã a gente parte daqui.
            </p>
            <Link
              to="/dormir"
              onClick={onClose}
              className="block rounded-xl border border-border py-2.5 text-center text-sm text-foreground active:scale-95"
            >
              Continuar em Fechar o Dia
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-[12px] text-muted-foreground active:scale-95"
            >
              Já está bom
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4">
              <DualInput
                value={text}
                onChange={setText}
                rows={5}
                placeholder="Como foi o dia de verdade? O que faltou?"
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-ember/40 bg-ember/10 py-2.5 text-sm text-ember disabled:opacity-40 active:scale-95"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Salvar registro do dia
            </button>
            <Link
              to="/dormir"
              onClick={onClose}
              className="mt-2 block py-2 text-center text-[12px] text-muted-foreground active:scale-95"
            >
              Prefiro conversar em Fechar o Dia
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
