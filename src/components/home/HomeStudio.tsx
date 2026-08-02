import { useEffect, useState } from "react";
import { Settings2, Compass, CalendarDays } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CaminhosPanel } from "./panels/CaminhosPanel";
import { AgendaPanel } from "./panels/AgendaPanel";

export type HomePanel = "caminhos" | "agenda";

const STORAGE_KEY = "wimi:home:panel";

const PANEL_META: Record<HomePanel, { label: string; hint: string; icon: typeof Compass }> = {
  caminhos: {
    label: "Caminhos",
    hint: "Guia holístico: planejar, executar, refletir, descansar, agenda e grupos.",
    icon: Compass,
  },
  agenda: {
    label: "Agenda",
    hint: "Seu mês inteiro no painel principal.",
    icon: CalendarDays,
  },
};

function readInitial(): HomePanel {
  if (typeof window === "undefined") return "caminhos";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "agenda" || raw === "caminhos" ? raw : "caminhos";
}

export function HomeStudio({
  marked,
  activitiesByWeekday,
}: {
  marked: number[];
  activitiesByWeekday: Record<number, string[]>;
}) {
  const [panel, setPanel] = useState<HomePanel>("caminhos");
  const [studioOpen, setStudioOpen] = useState(false);

  // Hidrata do localStorage no client (evita mismatch de SSR)
  useEffect(() => {
    setPanel(readInitial());
  }, []);

  function choose(next: HomePanel) {
    setPanel(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage indisponível — segue com estado em memória */
    }
    setStudioOpen(false);
  }

  const meta = PANEL_META[panel];

  return (
    <section className="px-4 pt-5">
      <header className="mb-3 flex items-center gap-3">
        <h2 className="font-display text-xl tracking-[0.16em] text-foreground">
          {meta.label.toUpperCase()}
        </h2>
        <span className="h-px flex-1 bg-border" />
        <Sheet open={studioOpen} onOpenChange={setStudioOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Abrir estúdio da home"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground active:forge-press-active"
            >
              <Settings2 className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="font-display tracking-wide">Estúdio da Home</SheetTitle>
              <SheetDescription>
                Escolha qual painel vai ocupar o centro da sua tela inicial.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 grid gap-2">
              {(Object.keys(PANEL_META) as HomePanel[]).map((k) => {
                const m = PANEL_META[k];
                const Icon = m.icon;
                const active = k === panel;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => choose(k)}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-ember bg-charcoal-900/60"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-charcoal-900 text-ember">
                      <Icon className="h-5 w-5" strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-base leading-tight tracking-wide text-foreground">
                        {m.label}
                      </span>
                      <span className="block text-[11px] leading-tight text-muted-foreground">
                        {m.hint}
                      </span>
                    </span>
                    {active && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-ember">
                        Ativo
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] leading-snug text-muted-foreground">
              Novos painéis (Executando em kanban, Descansar dedicado, Grupos familiares) chegam nas
              próximas versões — o estúdio já está preparado para recebê-los.
            </p>
          </SheetContent>
        </Sheet>
      </header>

      {panel === "caminhos" ? (
        <CaminhosPanel onOpenAgenda={() => choose("agenda")} />
      ) : (
        <AgendaPanel marked={marked} activitiesByWeekday={activitiesByWeekday} />
      )}
    </section>
  );
}
