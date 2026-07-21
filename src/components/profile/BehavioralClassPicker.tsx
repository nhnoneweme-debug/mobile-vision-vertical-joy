import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CLASS_META, type BehavioralClass } from "@/lib/behavior";

const ORDER: BehavioralClass[] = [
  "executor",
  "estrategista",
  "explorador",
  "guardiao",
  "visionario",
];

export function BehavioralClassPicker({
  userId,
  currentClass,
  onSaved,
}: {
  userId: string | null;
  currentClass: BehavioralClass;
  onSaved?: (next: BehavioralClass) => void;
}) {
  const [current, setCurrent] = useState<BehavioralClass>(currentClass);
  const [busy, setBusy] = useState(false);

  async function pick(next: BehavioralClass) {
    if (!userId || busy || next === current) return;
    setBusy(true);
    const prev = current;
    setCurrent(next);
    const { error } = await supabase
      .from("profiles")
      .update({ behavioral_class: next })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      setCurrent(prev);
      toast.error("Não foi possível trocar de classe");
      return;
    }
    onSaved?.(next);
    toast.success(`Classe agora: ${CLASS_META[next].name}`);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-3">
        <p className="font-display text-[10px] tracking-[0.3em] text-ember">
          CLASSE COMPORTAMENTAL
        </p>
        <span className="h-px flex-1 bg-border" />
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Sua classe define tom, missões e perks. XP, streak e vínculos permanecem
        intactos ao trocar — só a identidade muda.
      </p>

      <div className="grid gap-2">
        {ORDER.map((key) => {
          const meta = CLASS_META[key];
          const active = key === current;
          return (
            <button
              type="button"
              key={key}
              onClick={() => pick(key)}
              disabled={busy}
              className={
                "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors " +
                (active
                  ? "border-ember bg-ember/10"
                  : "border-border bg-charcoal-900 hover:border-ember/40")
              }
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-charcoal-900 text-2xl">
                {meta.emblem}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-display text-sm tracking-wide text-foreground">
                    {meta.name}
                  </span>
                  {active && (
                    <Check className="h-4 w-4 text-ember" strokeWidth={2.6} />
                  )}
                </span>
                <span className="mt-0.5 block font-display text-[10px] tracking-[0.25em] text-ember">
                  {meta.tagline}
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                  {meta.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] leading-snug text-muted-foreground">
        Em breve: Studio de Classes & Trilhas — construa suas próprias,
        acompanhe a progressão e conquiste badges quando finalizar.
      </p>
    </div>
  );
}
