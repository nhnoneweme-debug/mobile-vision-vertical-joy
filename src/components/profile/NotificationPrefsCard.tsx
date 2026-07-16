import { useEffect, useState } from "react";
import { Bell, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  getNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/ritual";

export function NotificationPrefsCard({ userId }: { userId: string | null }) {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getNotificationPrefs(userId).then(setPrefs).catch(() => {});
  }, [userId]);

  if (!prefs) {
    return (
      <div className="h-32 animate-pulse rounded-2xl border border-border bg-charcoal-800" />
    );
  }

  async function update(patch: Partial<NotificationPrefs>) {
    if (!userId || !prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    try {
      await saveNotificationPrefs(userId, next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-ember" strokeWidth={2.2} />
        <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
          RITUAL DIÁRIO
        </p>
      </div>
      <p className="mt-2 text-sm text-foreground">
        Quando você acorda e quando vai dormir. Nesses horários o dump aparece na home:
        de manhã pra registrar o sonho, à noite pra fechar o dia.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <HourPicker
          label="ACORDO ÀS"
          value={prefs.morning_hour}
          onChange={(v) => update({ morning_hour: v })}
        />
        <HourPicker
          label="DURMO ÀS"
          value={prefs.night_hour}
          onChange={(v) => update({ night_hour: v })}
        />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Fuso: {prefs.timezone}
      </p>

      <label className="mt-4 flex items-center justify-between rounded-xl border border-border bg-charcoal-900 px-4 py-3">
        <span className="font-display text-[11px] tracking-[0.25em] text-foreground">
          PUSH NO CELULAR
        </span>
        <input
          type="checkbox"
          checked={prefs.push_enabled}
          onChange={(e) => update({ push_enabled: e.target.checked })}
          className="h-5 w-5 accent-[var(--ember)]"
        />
      </label>
      {prefs.push_enabled && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Push depende da permissão do navegador. Sem ela, o dump ainda aparece como
          faixa na home nos seus horários.
        </p>
      )}
      {saving && (
        <p className="mt-2 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
          SALVANDO…
        </p>
      )}
    </div>
  );
}

function HourPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block rounded-xl border border-border bg-charcoal-900 px-3 py-2">
      <span className="flex items-center gap-1 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
        <Clock className="h-3 w-3" /> {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full bg-transparent font-display text-2xl tracking-wide text-foreground focus:outline-none"
      >
        {Array.from({ length: 24 }, (_, h) => (
          <option key={h} value={h} className="bg-charcoal-900">
            {h.toString().padStart(2, "0")}:00
          </option>
        ))}
      </select>
    </label>
  );
}
