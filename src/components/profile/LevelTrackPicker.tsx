import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  TRACK_OPTIONS,
  getTrack,
  rankFor,
  type LevelTrackKey,
} from "@/lib/level-tracks";

export function LevelTrackPicker({
  userId,
  xp,
}: {
  userId: string | null;
  xp: number;
}) {
  const [current, setCurrent] = useState<LevelTrackKey | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("level_track")
        .eq("id", userId)
        .maybeSingle();
      if (!active) return;
      const key = (data?.level_track ?? "warrior_m") as LevelTrackKey;
      setCurrent(key);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  async function pick(key: LevelTrackKey) {
    if (!userId || busy) return;
    setBusy(true);
    const prev = current;
    setCurrent(key);
    const { error } = await supabase
      .from("profiles")
      .update({ level_track: key })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      setCurrent(prev);
      toast.error("Não foi possível salvar a trilha");
      return;
    }
    toast.success(`Trilha definida: ${getTrack(key).label}`);
  }

  const level = Math.max(1, Math.floor(xp / 500) + 1);

  const groups = [
    { label: "MASCULINO", items: TRACK_OPTIONS.filter((t) => t.gender === "m") },
    { label: "FEMININO", items: TRACK_OPTIONS.filter((t) => t.gender === "f") },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-3">
        <p className="font-display text-[10px] tracking-[0.3em] text-ember">
          TRILHA DE NÍVEIS
        </p>
        <span className="h-px flex-1 bg-border" />
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Mesma matemática de XP. Apenas o nome do seu rank muda.
      </p>

      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
              {group.label}
            </p>
            <div className="grid grid-cols-1 gap-2">
              {group.items.map((track) => {
                const active = current === track.key;
                return (
                  <button
                    type="button"
                    key={track.key}
                    onClick={() => pick(track.key)}
                    disabled={busy}
                    className={
                      "flex items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors " +
                      (active
                        ? "border-ember bg-ember/10"
                        : "border-border bg-charcoal-900 hover:border-ember/40")
                    }
                  >
                    <div className="min-w-0">
                      <p className="font-display text-sm tracking-wide text-foreground">
                        {track.label}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        Atual: {rankFor(track, level)}
                      </p>
                    </div>
                    {active ? (
                      <Check
                        className="h-4 w-4 text-ember"
                        strokeWidth={2.6}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
