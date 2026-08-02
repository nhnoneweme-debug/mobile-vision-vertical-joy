// RELATÓRIO DE RETORNO POR GATILHO — o que foi ouvido, o que foi executado e
// qual o retorno de cada ação. Estados honestos: sem disparo, sem enfeite.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bot, X } from "lucide-react";
import {
  FIRING_RESULT_LABEL,
  buildReports,
  describeCondition,
  firingActionResults,
  firingMatchedText,
  formatCooldown,
  type TriggerDefinition,
  type TriggerFiring,
} from "@/lib/triggers";
import { summarizeTriggerReport } from "@/lib/triggers.functions";
import { useActuators } from "@/providers/ActuatorsProvider";

function hhmmss(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function originLabel(f: TriggerFiring) {
  if (f.result === "simulated" || f.source_kind === "simulation") return "teste";
  if (f.source_kind === "chain") return "encadeado";
  if (f.source_kind === "audio") return "voz (real)";
  if (f.source_kind === "chronos") return "cronos (real)";
  return f.source_kind ?? "real";
}

function FiringRow({ f }: { f: TriggerFiring }) {
  const results = firingActionResults(f);
  const matched = firingMatchedText(f);
  const remaining = Number((f.meta as Record<string, unknown>)?.cooldown_remaining_ms ?? 0);
  return (
    <li className="rounded-xl border border-border bg-charcoal-950/40 p-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-[11px] text-muted-foreground">{hhmmss(f.fired_at)}</span>
        <span className="rounded-full bg-charcoal-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {originLabel(f)}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
            f.result === "executed"
              ? "bg-ember/15 text-ember"
              : f.result === "simulated"
                ? "bg-sky-500/15 text-sky-400"
                : f.result === "failed"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-charcoal-800 text-muted-foreground"
          }`}
        >
          {FIRING_RESULT_LABEL[f.result] ?? f.result}
        </span>
      </div>
      {matched ? (
        <p className="mt-1 text-[12px] text-foreground">
          <span className="font-display text-[10px] uppercase tracking-wide text-ember">
            ouviu ·{" "}
          </span>
          “{matched}”
        </p>
      ) : null}
      {f.result === "suppressed_cooldown" && remaining > 0 ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          faltavam {formatCooldown(Math.round(remaining / 1000))} de cooldown
        </p>
      ) : null}
      {results.length ? (
        <ul className="mt-1.5 space-y-0.5">
          {results.map((r, i) => (
            <li key={`${r.action}-${i}`} className="text-[11px]">
              <span className={r.success ? "text-ember" : "text-destructive"}>
                {r.success ? "ok" : "falha"}
              </span>{" "}
              <span className="text-foreground">{r.action}</span>
              {r.detail ? <span className="text-muted-foreground"> · {r.detail}</span> : null}
            </li>
          ))}
        </ul>
      ) : f.result !== "suppressed_cooldown" ? (
        <p className="mt-1 text-[11px] text-muted-foreground">sem retorno de ação registrado</p>
      ) : null}
    </li>
  );
}

function Shell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-charcoal-900 p-4 sm:rounded-2xl">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-display text-[12px] uppercase tracking-[0.16em] text-ember">
              {title}
            </h4>
            {subtitle ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="shrink-0 rounded-md border border-border p-1 text-muted-foreground active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

export function TriggerReportSheet({
  trigger,
  firings,
  onClose,
}: {
  trigger: TriggerDefinition;
  firings: TriggerFiring[];
  onClose: () => void;
}) {
  const own = useMemo(
    () =>
      firings
        .filter((f) => f.trigger_id === trigger.id)
        .sort((a, b) => (a.fired_at < b.fired_at ? 1 : -1))
        .slice(0, 20),
    [firings, trigger.id],
  );
  return (
    <Shell
      title={`Relatório · ${trigger.name}`}
      subtitle={`${describeCondition(trigger)} · cooldown ${formatCooldown(trigger.cooldown_seconds)}`}
      onClose={onClose}
    >
      {own.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-charcoal-950/40 p-3 text-[12px] text-muted-foreground">
          nunca disparou
        </p>
      ) : (
        <ul className="space-y-2">
          {own.map((f) => (
            <FiringRow key={f.id} f={f} />
          ))}
        </ul>
      )}
    </Shell>
  );
}

export function GeneralReportSheet({
  triggers,
  firings,
  onClose,
}: {
  triggers: TriggerDefinition[];
  firings: TriggerFiring[];
  onClose: () => void;
}) {
  const actuators = useActuators();
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reports = useMemo(
    () => buildReports(triggers, firings, 5),
    [triggers, firings],
  );

  const summarize = async () => {
    setLoading(true);
    try {
      const payload = reports.map((r) => ({
        nome: r.trigger.trigger_type ? r.trigger.name : r.trigger.name,
        condicao: describeCondition(r.trigger),
        habilitado: r.trigger.enabled,
        cooldown: formatCooldown(r.trigger.cooldown_seconds),
        disparos: r.firings.map((f) => ({
          quando: f.fired_at,
          origem: originLabel(f),
          resultado: f.result,
          ouviu: firingMatchedText(f),
          acoes: firingActionResults(f),
        })),
        acoes_ok: r.actionsOk,
        acoes_falha: r.actionsFail,
      }));
      const res = await summarizeTriggerReport({
        data: { report_json: JSON.stringify(payload).slice(0, 19000) },
      });
      setSummary(res.message);
      actuators.speak(res.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "A WiMi não conseguiu resumir agora.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell
      title="Relatório geral"
      subtitle="últimos disparos e taxa de sucesso das ações"
      onClose={onClose}
    >
      <button
        type="button"
        disabled={loading}
        onClick={() => void summarize()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-ember/40 bg-ember/10 py-2.5 text-sm text-ember disabled:opacity-40 active:scale-95"
      >
        <Bot className="h-4 w-4 shrink-0" />
        {loading ? "a WiMi está lendo…" : "Resumir com a WiMi"}
      </button>
      {summary ? (
        <p className="mt-3 rounded-xl border border-ember/30 bg-ember/5 p-3 text-[13px] text-foreground">
          {summary}
        </p>
      ) : null}

      <ul className="mt-3 space-y-3">
        {reports.map((r) => (
          <li key={r.trigger.id} className="rounded-xl border border-border bg-charcoal-950/30 p-3">
            <p className="truncate text-sm text-foreground">{r.trigger.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {describeCondition(r.trigger)} · cooldown {formatCooldown(r.trigger.cooldown_seconds)}
            </p>
            <p className="mt-1 text-[11px]">
              {r.successRate == null ? (
                <span className="text-muted-foreground">nunca disparou</span>
              ) : (
                <>
                  <span className="text-ember">{Math.round(r.successRate * 100)}% de sucesso</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {r.actionsOk} ok / {r.actionsFail} falha
                    {r.lastAt ? ` · último ${hhmmss(r.lastAt)}` : ""}
                  </span>
                </>
              )}
            </p>
            {r.firings.length ? (
              <ul className="mt-2 space-y-2">
                {r.firings.slice(0, 3).map((f) => (
                  <FiringRow key={f.id} f={f} />
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
