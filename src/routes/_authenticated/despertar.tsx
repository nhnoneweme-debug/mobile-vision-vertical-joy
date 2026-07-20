import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlarmClock, Plus, Sun, Trash2 } from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";
import { listAlarms, upsertAlarm, deleteAlarm, startWakeSession } from "@/lib/wake.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/despertar")({
  head: () => ({ meta: [{ title: "Despertar — WiMi" }] }),
  component: DespertarPage,
});

type Alarm = {
  id: string;
  label: string;
  time_local: string;
  days_of_week: number[];
  enabled: boolean;
};

const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

function DespertarPage() {
  const navigate = useNavigate();
  const [alarms, setAlarms] = useState<Alarm[] | null>(null);
  const [newTime, setNewTime] = useState("07:00");
  const [newLabel, setNewLabel] = useState("Despertar");
  const [newDays, setNewDays] = useState<number[]>([1, 2, 3, 4, 5]);

  async function refresh() {
    try {
      const rows = await listAlarms();
      setAlarms(
        (rows ?? []).map((r) => ({
          id: r.id as string,
          label: r.label as string,
          time_local: (r.time_local as string).slice(0, 5),
          days_of_week: (r.days_of_week as number[] | null) ?? [],
          enabled: !!r.enabled,
        })),
      );
    } catch (e) {
      toast.error("Não foi possível carregar alarmes", { description: String(e) });
      setAlarms([]);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function toggle(a: Alarm) {
    try {
      await upsertAlarm({
        data: {
          id: a.id,
          label: a.label,
          time_local: a.time_local,
          days_of_week: a.days_of_week,
          enabled: !a.enabled,
          wake_style: "gentle",
          max_snoozes: 3,
          snooze_strategy: "adaptive",
        },
      });
      void refresh();
    } catch (e) {
      toast.error("Falhou", { description: String(e) });
    }
  }

  async function remove(id: string) {
    try {
      await deleteAlarm({ data: { id } });
      void refresh();
    } catch (e) {
      toast.error("Falhou", { description: String(e) });
    }
  }

  async function criar() {
    try {
      await upsertAlarm({
        data: {
          label: newLabel || "Despertar",
          time_local: newTime,
          days_of_week: newDays,
          enabled: true,
          wake_style: "gentle",
          max_snoozes: 3,
          snooze_strategy: "adaptive",
        },
      });
      toast.success("Alarme criado");
      void refresh();
    } catch (e) {
      toast.error("Falhou", { description: String(e) });
    }
  }

  async function despertarAgora() {
    try {
      const s = await startWakeSession({ data: {} });
      void navigate({
        to: "/despertar/ringing",
        search: { session: (s?.id as string) ?? "", label: "Despertar agora" } as never,
      });
    } catch (e) {
      toast.error("Falhou", { description: String(e) });
    }
  }

  return (
    <MobileShell>
      <div className="p-5 flex flex-col gap-5">
        <header className="flex items-center gap-3">
          <AlarmClock className="h-6 w-6 text-ember" strokeWidth={2} />
          <div className="flex-1">
            <h1 className="font-display text-2xl tracking-wide">Despertar</h1>
            <p className="text-xs text-muted-foreground">
              A WiMi acorda você e conduz sonho → planejamento → execução.
            </p>
          </div>
        </header>

        <button
          type="button"
          onClick={despertarAgora}
          className="flex items-center justify-center gap-2 rounded-xl bg-ember py-3 font-display tracking-wide text-primary-foreground ember-glow"
        >
          <Sun className="h-4 w-4" /> Simular despertar agora
        </button>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-sm tracking-[0.2em] text-muted-foreground">SEUS ALARMES</h2>
          {alarms === null && <p className="text-xs text-muted-foreground">Carregando…</p>}
          {alarms?.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum alarme ainda. Crie um abaixo.</p>
          )}
          {alarms?.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-charcoal-900/60 p-3"
            >
              <button
                type="button"
                onClick={() => toggle(a)}
                className={`grid h-12 w-12 place-items-center rounded-xl border ${
                  a.enabled ? "border-ember bg-ember/20 text-ember" : "border-border bg-charcoal-800 text-muted-foreground"
                }`}
                aria-label={a.enabled ? "Desativar" : "Ativar"}
              >
                <span className="font-mono text-xs">{a.enabled ? "ON" : "OFF"}</span>
              </button>
              <div className="flex-1">
                <p className="font-mono text-2xl tracking-wide">{a.time_local}</p>
                <p className="text-[11px] text-muted-foreground">
                  {a.label} · {a.days_of_week.length ? a.days_of_week.map((d) => DAY_LABELS[d]).join(" ") : "todos os dias"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(a.id)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground/60 hover:text-ember"
                aria-label="Remover alarme"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-charcoal-900/60 p-4">
          <h2 className="font-display text-sm tracking-[0.2em] text-muted-foreground">NOVO ALARME</h2>
          <div className="flex gap-3">
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="w-32 rounded-xl border border-border bg-charcoal-800 p-2 font-mono text-lg outline-none focus:border-ember"
            />
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Rótulo"
              className="flex-1 rounded-xl border border-border bg-charcoal-800 p-2 text-sm outline-none focus:border-ember"
            />
          </div>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((d, i) => {
              const on = newDays.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() =>
                    setNewDays((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort()))
                  }
                  className={`h-9 w-9 rounded-lg text-xs font-display ${
                    on ? "bg-ember text-primary-foreground" : "border border-border bg-charcoal-800 text-muted-foreground"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={criar}
            className="flex items-center justify-center gap-2 rounded-xl border border-ember/50 bg-ember/10 py-2 text-sm text-ember"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
          <p className="text-[10px] leading-tight text-muted-foreground">
            Web/PWA: o alarme dispara enquanto o app estiver aberto em segundo plano no navegador. Para alarmes 100%
            confiáveis, mantenha a aba aberta ou instale como PWA.
          </p>
        </section>
      </div>
    </MobileShell>
  );
}
