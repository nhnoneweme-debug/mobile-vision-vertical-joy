import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Moon, Save, Star } from "lucide-react";
import { listSleepLogs, upsertSleepLog } from "@/lib/wake.functions";

type Row = {
  date: string;
  bed_at: string | null;
  sleep_at: string | null;
  wake_at: string | null;
  quality: number | null;
  ritual_done: boolean;
  notes: string | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function durationHours(bed: string | null, wake: string | null): number | null {
  if (!bed || !wake) return null;
  const b = new Date(bed).getTime();
  let w = new Date(wake).getTime();
  if (w < b) w += 24 * 3600 * 1000;
  return Math.round(((w - b) / 3600000) * 10) / 10;
}

function timeOfDay(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function QuartoSleepCard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bed, setBed] = useState("");
  const [wake, setWake] = useState("");
  const [quality, setQuality] = useState(0);

  const fnList = useServerFn(listSleepLogs);
  const fnUpsert = useServerFn(upsertSleepLog);

  useEffect(() => {
    (async () => {
      try {
        const r = (await fnList()) as Row[];
        setRows(r ?? []);
        const today = r?.find((x) => x.date === todayISO());
        if (today) {
          setBed(timeOfDay(today.bed_at));
          setWake(timeOfDay(today.wake_at));
          setQuality(today.quality ?? 0);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [fnList]);

  const avg = useMemo(() => {
    const valid = rows
      .map((r) => durationHours(r.bed_at, r.wake_at))
      .filter((x): x is number => x !== null);
    if (!valid.length) return null;
    return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
  }, [rows]);

  async function handleSave() {
    if (!bed || !wake) {
      toast.error("Informe hora de deitar e acordar");
      return;
    }
    setSaving(true);
    try {
      const date = todayISO();
      // bed_at é da noite anterior se a hora for tarde (após 18h), considere mesma data
      const bedIso = new Date(`${date}T${bed}:00`).toISOString();
      const wakeIso = new Date(`${date}T${wake}:00`).toISOString();
      await fnUpsert({
        data: {
          date,
          bed_at: bedIso,
          wake_at: wakeIso,
          quality: quality > 0 ? quality : undefined,
        },
      });
      const r = (await fnList()) as Row[];
      setRows(r ?? []);
      toast.success("Sono registrado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ember/30 bg-ember/5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-ember" />
          <p className="font-display text-[10px] tracking-[0.3em] text-ember">
            SONO DE HOJE
          </p>
        </div>
        {avg !== null && (
          <span className="font-display text-[10px] tracking-[0.2em] text-muted-foreground">
            MÉDIA 14d · {avg}h
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-display text-[10px] tracking-[0.2em] text-muted-foreground">
            DEITEI
          </span>
          <input
            type="time"
            value={bed}
            onChange={(e) => setBed(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ember focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-display text-[10px] tracking-[0.2em] text-muted-foreground">
            ACORDEI
          </span>
          <input
            type="time"
            value={wake}
            onChange={(e) => setWake(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ember focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="font-display text-[10px] tracking-[0.2em] text-muted-foreground">
          QUALIDADE
        </span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setQuality(n)}
              aria-label={`${n} estrelas`}
              className="p-1"
            >
              <Star
                className={`h-5 w-5 ${
                  n <= quality ? "fill-ember text-ember" : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ember px-3 py-2 font-display text-[11px] tracking-[0.2em] text-charcoal-900 disabled:opacity-50"
      >
        <Save className="h-3 w-3" />
        {saving ? "SALVANDO…" : "REGISTRAR SONO"}
      </button>

      {!loading && rows.length > 0 && (
        <div className="mt-4">
          <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
            ÚLTIMAS NOITES
          </p>
          <ul className="mt-2 space-y-1">
            {rows.slice(0, 7).map((r) => {
              const h = durationHours(r.bed_at, r.wake_at);
              return (
                <li
                  key={r.date}
                  className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-1.5 text-xs"
                >
                  <span className="text-muted-foreground">{r.date.slice(5)}</span>
                  <span className="text-foreground">
                    {h !== null ? `${h}h` : "—"}
                    {r.quality ? (
                      <span className="ml-2 text-ember">{"★".repeat(r.quality)}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
