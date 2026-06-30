import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ChefHat, Dumbbell, Brain, Heart, Moon, Sun, MoonStar, MapPin, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { MobileShell } from "@/components/shell/MobileShell";
import { BottomNav } from "@/components/shell/BottomNav";
import { listDayBlocks, createDayBlock, completeDayBlock } from "@/lib/wake.functions";

export const Route = createFileRoute("/_authenticated/jornada")({
  head: () => ({ meta: [{ title: "Jornada do Dia — Personal IA" }] }),
  component: JornadaPage,
});

type Block = Awaited<ReturnType<typeof listDayBlocks>>[number];
type Kind = "wake" | "dream" | "kitchen" | "move" | "deep_work" | "family" | "wind_down" | "sleep";

const KINDS: { kind: Kind; label: string; Icon: typeof Sun }[] = [
  { kind: "wake", label: "Despertar", Icon: Sun },
  { kind: "dream", label: "Sonho", Icon: MoonStar },
  { kind: "kitchen", label: "Cozinha", Icon: ChefHat },
  { kind: "move", label: "Movimento", Icon: Dumbbell },
  { kind: "deep_work", label: "Foco Profundo", Icon: Brain },
  { kind: "family", label: "Família", Icon: Heart },
  { kind: "wind_down", label: "Desacelerar", Icon: Moon },
  { kind: "sleep", label: "Dormir", Icon: Moon },
];

function JornadaPage() {
  const list = useServerFn(listDayBlocks);
  const create = useServerFn(createDayBlock);
  const complete = useServerFn(completeDayBlock);
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<Block[]>([]);

  function askIA() {
    try {
      sessionStorage.setItem(
        "ia.seed",
        "Monte minha jornada de hoje em blocos: despertar, refeições, treino, foco profundo, família, desacelerar e dormir — respeitando minha rotina e meu tempo/dia disponível. Salve cada bloco como uma quest de hoje.",
      );
    } catch {}
    navigate({ to: "/ia" });
  }

  async function refresh() {
    try {
      setBlocks(await list({ data: {} }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "erro");
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function start(kind: Kind) {
    try {
      await create({ data: { kind } });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "erro");
    }
  }

  async function done(id: string) {
    try {
      await complete({ data: { id } });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "erro");
    }
  }

  return (
    <MobileShell>
      <header className="sticky top-0 z-20 border-b border-border bg-charcoal-900/85 px-4 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-ember" />
          <div>
            <h1 className="font-display text-xl tracking-wide">JORNADA DO DIA</h1>
            <p className="text-[11px] text-muted-foreground">Acordar → blocos → dormir.</p>
          </div>
        </div>
      </header>

      <div className="space-y-5 px-4 py-5 pb-32">
        <button
          onClick={askIA}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-ember/40 bg-ember/10 px-4 py-3 text-sm text-ember active:scale-[0.98]"
        >
          <Sparkles className="h-4 w-4" />
          Pedir pra IA montar meu dia
        </button>

        <section>
          <h2 className="mb-2 font-display text-sm text-muted-foreground">+ ADICIONAR BLOCO MANUAL</h2>
          <div className="grid grid-cols-4 gap-2">
            {KINDS.map(({ kind, label, Icon }) => (
              <button
                key={kind}
                onClick={() => start(kind)}
                className="flex flex-col items-center gap-1 rounded-xl border border-border bg-charcoal-800/40 p-2 text-[10px] active:scale-95"
              >
                <Icon className="h-5 w-5 text-ember" />
                <span className="leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-display text-sm text-muted-foreground">HOJE</h2>
          {blocks.length === 0 ? (
            <div className="rounded-xl border border-border bg-charcoal-800/40 p-6 text-center text-sm text-muted-foreground">
              Nenhum bloco ainda. Comece pelo seu despertar.
            </div>
          ) : (
            <ol className="space-y-2">
              {blocks.map((b) => {
                const meta = KINDS.find((k) => k.kind === b.kind);
                const Icon = meta?.Icon ?? Sun;
                return (
                  <li
                    key={b.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-charcoal-800/40 p-3"
                  >
                    <span
                      className={
                        "flex h-9 w-9 items-center justify-center rounded-full " +
                        (b.completed ? "bg-ember/20 text-ember" : "bg-charcoal-700 text-muted-foreground")
                      }
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm">{meta?.label ?? b.kind}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {b.started_at
                          ? new Date(b.started_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                        {b.ended_at
                          ? ` → ${new Date(b.ended_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : ""}
                      </p>
                    </div>
                    {!b.completed && (
                      <button
                        onClick={() => done(b.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-ember text-charcoal-900"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <BottomNav />
    </MobileShell>
  );
}
