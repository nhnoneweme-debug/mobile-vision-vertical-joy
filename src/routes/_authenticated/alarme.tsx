import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, AlarmClock, Play } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { MobileShell } from "@/components/shell/MobileShell";
import { listAlarms, upsertAlarm, deleteAlarm, startWakeSession } from "@/lib/wake.functions";

export const Route = createFileRoute("/_authenticated/alarme")({
  head: () => ({ meta: [{ title: "Alarmes — Personal IA" }] }),
  component: AlarmesPage,
});

type Alarm = Awaited<ReturnType<typeof listAlarms>>[number];

const DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function AlarmesPage() {
  const list = useServerFn(listAlarms);
  const upsert = useServerFn(upsertAlarm);
  const del = useServerFn(deleteAlarm);
  const start = useServerFn(startWakeSession);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    label: "Despertar",
    time_local: "06:30",
    days_of_week: [1, 2, 3, 4, 5] as number[],
    wake_style: "gentle" as "gentle" | "firm" | "energetic" | "custom",
    max_snoozes: 3,
    snooze_strategy: "adaptive" as "fixed" | "adaptive",
    enabled: true,
  });

  async function refresh() {
    try {
      setAlarms(await list());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "erro");
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function save() {
    try {
      await upsert({ data: form });
      toast.success("Alarme salvo");
      setEditing(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "erro");
    }
  }

  async function ringNow(a: Alarm) {
    const s = await start({ data: { alarm_id: a.id } });
    window.location.href = `/despertar?s=${s.id}`;
  }

  function toggleDay(d: number) {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(d) ? f.days_of_week.filter((x) => x !== d) : [...f.days_of_week, d].sort(),
    }));
  }

  return (
    <MobileShell>
      <header className="sticky top-0 z-20 border-b border-border bg-charcoal-900/85 px-4 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl tracking-wide">ALARMES</h1>
            <p className="text-[11px] text-muted-foreground">A IA acorda você. Você negocia.</p>
          </div>
          <button
            onClick={() => setEditing((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ember text-charcoal-900"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="space-y-3 px-4 py-5 pb-32">
        {editing && (
          <div className="space-y-3 rounded-xl border border-ember/40 bg-ember/5 p-3">
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full rounded-lg border border-border bg-charcoal-800/60 px-3 py-2 text-sm"
              placeholder="Rótulo"
            />
            <input
              type="time"
              value={form.time_local.slice(0, 5)}
              onChange={(e) => setForm({ ...form, time_local: e.target.value })}
              className="w-full rounded-lg border border-border bg-charcoal-800/60 px-3 py-2 text-sm"
            />
            <div className="flex justify-between gap-1">
              {DAYS.map((d, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={
                    "h-9 flex-1 rounded-lg border text-xs " +
                    (form.days_of_week.includes(i)
                      ? "border-ember bg-ember text-charcoal-900"
                      : "border-border text-muted-foreground")
                  }
                >
                  {d}
                </button>
              ))}
            </div>
            <select
              value={form.wake_style}
              onChange={(e) => setForm({ ...form, wake_style: e.target.value as typeof form.wake_style })}
              className="w-full rounded-lg border border-border bg-charcoal-800/60 px-3 py-2 text-sm"
            >
              <option value="gentle">Gentil</option>
              <option value="firm">Firme</option>
              <option value="energetic">Energético</option>
              <option value="custom">Custom</option>
            </select>
            <div className="flex gap-2">
              <select
                value={form.snooze_strategy}
                onChange={(e) =>
                  setForm({ ...form, snooze_strategy: e.target.value as typeof form.snooze_strategy })
                }
                className="flex-1 rounded-lg border border-border bg-charcoal-800/60 px-3 py-2 text-sm"
              >
                <option value="adaptive">Snooze adaptativo</option>
                <option value="fixed">Snooze fixo</option>
              </select>
              <input
                type="number"
                min={0}
                max={10}
                value={form.max_snoozes}
                onChange={(e) => setForm({ ...form, max_snoozes: Number(e.target.value) })}
                className="w-20 rounded-lg border border-border bg-charcoal-800/60 px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={save}
              className="w-full rounded-lg bg-ember py-2 text-sm font-medium text-charcoal-900"
            >
              Salvar
            </button>
          </div>
        )}

        {alarms.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-xl border border-border bg-charcoal-800/40 p-3"
          >
            <div>
              <p className="font-display text-2xl tracking-wider">{a.time_local.slice(0, 5)}</p>
              <p className="text-xs text-muted-foreground">
                {a.label} · {a.wake_style} · {a.days_of_week.map((d: number) => DAYS[d]).join(" ")}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => ringNow(a)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-ember text-charcoal-900"
                title="Disparar agora"
              >
                <Play className="h-4 w-4" />
              </button>
              <button
                onClick={async () => {
                  await del({ data: { id: a.id } });
                  refresh();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {alarms.length === 0 && !editing && (
          <div className="rounded-xl border border-border bg-charcoal-800/40 p-6 text-center text-sm text-muted-foreground">
            <AlarmClock className="mx-auto mb-2 h-8 w-8 text-ember" />
            Nenhum alarme. Toque em + pra criar o primeiro.
          </div>
        )}

        <Link
          to="/sonhos"
          className="block rounded-xl border border-border bg-charcoal-800/30 p-3 text-center text-xs text-muted-foreground"
        >
          Ver diário de sonhos →
        </Link>
      </div>

    </MobileShell>
  );
}
