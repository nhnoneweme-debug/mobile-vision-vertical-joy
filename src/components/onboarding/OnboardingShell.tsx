import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Home } from "lucide-react";


type Props = {
  step: number; // 1-based
  total: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function OnboardingShell({
  step,
  total,
  title,
  subtitle,
  onBack,
  children,
  footer,
}: Props) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-background">
      <header
        className="px-4 pb-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={!onBack}
            className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-foreground disabled:opacity-40"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
          </button>
          <div className="flex flex-1 gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  i < step ? "bg-ember" : "bg-border"
                }`}
              />
            ))}
          </div>
          <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
            {step}/{total}
          </span>
        </div>

        <div className="mt-5">
          <h1 className="font-display text-3xl leading-none tracking-wide text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-6">{children}</main>

      {footer && (
        <footer
          className="border-t border-border bg-background/80 px-4 py-4 backdrop-blur"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          {footer}
        </footer>
      )}
    </div>
  );
}
