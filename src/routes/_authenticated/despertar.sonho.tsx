import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Moon, SkipForward } from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";
import { logDream } from "@/lib/wake.functions";
import { z } from "zod";
import { toast } from "sonner";

const searchSchema = z.object({ session: z.string().optional().default("") });

export const Route = createFileRoute("/_authenticated/despertar/sonho")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Sonho — WiMi" }] }),
  component: SonhoPage,
});

const MOODS: { key: string; label: string }[] = [
  { key: "bom", label: "Bom sonho" },
  { key: "neutro", label: "Neutro" },
  { key: "pesadelo", label: "Pesadelo" },
  { key: "nao_lembro", label: "Não lembro" },
];

function SonhoPage() {
  const { session } = Route.useSearch();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [mood, setMood] = useState<string>("neutro");
  const [busy, setBusy] = useState(false);

  async function salvar() {
    if (!text.trim() && mood !== "nao_lembro") {
      toast.info("Escreva algo ou marque 'não lembro'");
      return;
    }
    setBusy(true);
    try {
      await logDream({
        data: {
          session_id: session || undefined,
          raw_text: text.trim() || "(sem descrição)",
          mood,
        },
      });
      toast.success("Sonho registrado");
    } catch (e) {
      toast.error("Não foi possível salvar", { description: String(e) });
    } finally {
      setBusy(false);
      void navigate({ to: "/despertar/planejar" });
    }
  }

  return (
    <MobileShell hideNav>
      <div className="p-5 flex flex-col gap-5 min-h-[100dvh]">
        <header className="flex items-center gap-3">
          <Moon className="h-6 w-6 text-ember" strokeWidth={2} />
          <h1 className="font-display text-2xl tracking-wide">O que sonhou?</h1>
        </header>
        <p className="text-sm text-muted-foreground -mt-2">
          Registrar agora, quente, ajuda a WiMi a entender seus padrões.
        </p>

        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMood(m.key)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                mood === m.key
                  ? "border-ember bg-ember/20 text-foreground"
                  : "border-border bg-charcoal-800 text-muted-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Cenas, pessoas, sensações…"
          rows={8}
          className="w-full flex-1 rounded-2xl border border-border bg-charcoal-900 p-4 text-base outline-none focus:border-ember"
        />

        <div className="flex gap-2 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={() => navigate({ to: "/despertar/planejar" })}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm text-muted-foreground"
          >
            <SkipForward className="h-4 w-4" /> Pular
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={salvar}
            className="flex-[2] rounded-xl bg-ember py-3 font-display tracking-wide text-primary-foreground ember-glow disabled:opacity-50"
          >
            Salvar e seguir
          </button>
        </div>
      </div>
    </MobileShell>
  );
}
