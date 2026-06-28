import { useState } from "react";
import { Plus } from "lucide-react";

const ICON_OPTIONS = ["flame", "zap", "droplet", "dumbbell", "clipboard", "sparkles", "moon", "heart", "utensils", "book", "trees", "eye"];

export function HabitForm({
  onSubmit,
  pending,
}: {
  onSubmit: (input: { title: string; icon: string; target_per_week: number }) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("flame");
  const [target, setTarget] = useState(7);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-transparent px-4 py-4 font-display text-sm tracking-[0.2em] text-muted-foreground hover:text-ember"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        NOVO HÁBITO
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-charcoal-900/80 p-4">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Ex.: Meditar 5 min"
        maxLength={60}
        className="w-full rounded-xl border border-border bg-charcoal-800 px-3 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-ember focus:outline-none"
      />

      <div>
        <p className="mb-2 font-display text-[10px] tracking-[0.25em] text-muted-foreground">ÍCONE</p>
        <div className="flex flex-wrap gap-2">
          {ICON_OPTIONS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              className={`rounded-lg border px-2 py-1 text-[11px] ${
                icon === i ? "border-ember text-ember" : "border-border text-muted-foreground"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 font-display text-[10px] tracking-[0.25em] text-muted-foreground">
          META: {target}x / semana
        </p>
        <input
          type="range"
          min={1}
          max={7}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="w-full accent-ember"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setOpen(false); setTitle(""); }}
          className="flex-1 rounded-xl border border-border px-4 py-3 font-display text-sm tracking-[0.18em] text-muted-foreground"
        >
          CANCELAR
        </button>
        <button
          type="button"
          disabled={!title.trim() || pending}
          onClick={() => {
            onSubmit({ title: title.trim(), icon, target_per_week: target });
            setTitle("");
            setOpen(false);
          }}
          className="ember-glow flex-1 rounded-xl bg-primary px-4 py-3 font-display text-sm tracking-[0.18em] text-primary-foreground disabled:opacity-50"
        >
          CRIAR
        </button>
      </div>
    </div>
  );
}
