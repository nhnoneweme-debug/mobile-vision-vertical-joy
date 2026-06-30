import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sprout, Check } from "lucide-react";
import {
  getTodayMentalEntry,
  saveTodayMentalEntry,
  type MentalEntry,
} from "@/lib/area-extra";

export function MentalJournalCard({ userId }: { userId: string }) {
  const [g, setG] = useState<[string, string, string]>(["", "", ""]);
  const [belief, setBelief] = useState("");
  const [reframe, setReframe] = useState("");
  const [saving, setSaving] = useState(false);
  const [entry, setEntry] = useState<MentalEntry | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const e = await getTodayMentalEntry(userId);
        if (e) {
          setEntry(e);
          setG([e.gratitudes[0] ?? "", e.gratitudes[1] ?? "", e.gratitudes[2] ?? ""]);
          setBelief(e.limiting_belief ?? "");
          setReframe(e.reframe ?? "");
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, [userId]);

  async function handleSave() {
    setSaving(true);
    try {
      const e = await saveTodayMentalEntry(userId, {
        gratitudes: g,
        limiting_belief: belief,
        reframe,
      });
      setEntry(e);
      toast.success("Diário mental salvo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function update(i: 0 | 1 | 2, v: string) {
    setG((prev) => {
      const n = [...prev] as [string, string, string];
      n[i] = v;
      return n;
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Sprout className="h-4 w-4 text-emerald-400" />
        <p className="font-display text-[10px] tracking-[0.3em] text-emerald-400">
          DIÁRIO MENTAL · HOJE
        </p>
      </div>

      <p className="mt-3 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
        3 GRATIDÕES
      </p>
      <div className="mt-2 space-y-2">
        {[0, 1, 2].map((i) => (
          <input
            key={i}
            value={g[i as 0 | 1 | 2]}
            onChange={(e) => update(i as 0 | 1 | 2, e.target.value)}
            placeholder={`Gratidão ${i + 1}`}
            maxLength={120}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ember focus:outline-none"
          />
        ))}
      </div>

      <p className="mt-4 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
        CRENÇA LIMITANTE
      </p>
      <textarea
        value={belief}
        onChange={(e) => setBelief(e.target.value)}
        rows={2}
        maxLength={240}
        placeholder="Ex: 'eu não tenho disciplina'"
        className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ember focus:outline-none"
      />

      <p className="mt-4 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
        REFRAMING (OPCIONAL)
      </p>
      <textarea
        value={reframe}
        onChange={(e) => setReframe(e.target.value)}
        rows={2}
        maxLength={240}
        placeholder="Como você reescreve isso de outra forma?"
        className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ember focus:outline-none"
      />

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-ember px-3 py-2.5 font-display text-[11px] tracking-[0.25em] text-charcoal-900 disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" />
        {saving ? "SALVANDO…" : entry ? "ATUALIZAR DIÁRIO" : "SALVAR DIÁRIO"}
      </button>
    </div>
  );
}
