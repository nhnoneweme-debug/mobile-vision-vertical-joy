import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { THEMES, getStoredTheme, setTheme, type ThemeId } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemePicker() {
  const [current, setCurrent] = useState<ThemeId>("charcoal-ember");

  useEffect(() => {
    setCurrent(getStoredTheme());
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<ThemeId>;
      setCurrent(ce.detail);
    };
    window.addEventListener("personal-ia:theme", onChange);
    return () => window.removeEventListener("personal-ia:theme", onChange);
  }, []);

  function handle(id: ThemeId) {
    setTheme(id);
    setCurrent(id);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-[10px] tracking-[0.3em] text-ember">
          APARÊNCIA
        </p>
        <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
          7 SKINS
        </p>
      </div>
      <h3 className="mt-1 font-display text-xl tracking-wide text-foreground">
        Skin do mundo
      </h3>

      <ul className="mt-4 grid gap-2">
        {THEMES.map((t) => {
          const active = current === t.id;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => handle(t.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-background px-3 py-2.5 text-left transition-colors active:scale-[0.99]",
                  active ? "border-ember" : "border-border hover:border-ember/40",
                )}
              >
                <div className="flex shrink-0 overflow-hidden rounded-md border border-border">
                  {t.swatches.map((c, i) => (
                    <span
                      key={i}
                      className="block h-9 w-4"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base leading-none tracking-wide text-foreground">
                    {t.name}
                  </p>
                  <p className="mt-1 font-display text-[10px] tracking-[0.25em] text-muted-foreground">
                    {t.tagline.toUpperCase()}
                  </p>
                </div>
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full border",
                    active
                      ? "border-ember bg-ember text-primary-foreground"
                      : "border-border text-transparent",
                  )}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
