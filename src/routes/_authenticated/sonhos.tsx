import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MoonStar, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { MobileShell } from "@/components/shell/MobileShell";
import { listDreams, logDream } from "@/lib/wake.functions";

export const Route = createFileRoute("/_authenticated/sonhos")({
  head: () => ({ meta: [{ title: "Sonhos — Personal IA" }] }),
  component: SonhosPage,
});

type Dream = Awaited<ReturnType<typeof listDreams>>[number];

function SonhosPage() {
  const list = useServerFn(listDreams);
  const log = useServerFn(logDream);
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [text, setText] = useState("");
  const [mood, setMood] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    try {
      setDreams(await list());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "erro");
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await log({ data: { raw_text: text.trim(), mood: mood.trim() || undefined } });
      setText("");
      setMood("");
      toast.success("Sonho registrado");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileShell>
      <header className="sticky top-0 z-20 border-b border-border bg-charcoal-900/85 px-4 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MoonStar className="h-5 w-5 text-ember" />
            <h1 className="font-display text-xl tracking-wide">SONHOS</h1>
          </div>
          <Link to="/despertar" className="text-[11px] text-ember underline-offset-2 hover:underline">
            Despertar →
          </Link>
        </div>
        <p className="text-[11px] text-muted-foreground">
          O que veio ao acordar? Símbolos, lugares, emoções.
        </p>
      </header>

      <div className="space-y-4 px-4 py-5 pb-32">
        <div className="space-y-2 rounded-xl border border-ember/40 bg-ember/5 p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Conte o sonho com suas palavras…"
            rows={4}
            className="w-full resize-none rounded-lg border border-border bg-charcoal-800/60 px-3 py-2 text-sm outline-none focus:border-ember"
          />
          <input
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder="Humor ao acordar (opcional)"
            className="w-full rounded-lg border border-border bg-charcoal-800/60 px-3 py-2 text-sm outline-none focus:border-ember"
          />
          <button
            onClick={save}
            disabled={saving || !text.trim()}
            className="flex w-full items-center justify-center gap-1 rounded-lg bg-ember py-2 text-sm font-medium text-charcoal-900 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" /> Registrar
          </button>
        </div>

        {dreams.length === 0 ? (
          <div className="rounded-xl border border-border bg-charcoal-800/40 p-6 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-ember" />
            Nada registrado ainda. Você pode também pedir à companheira no despertar.
          </div>
        ) : (
          dreams.map((d) => (
            <article
              key={d.id}
              className="space-y-2 rounded-xl border border-border bg-charcoal-800/40 p-3"
            >
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{new Date(d.logged_at).toLocaleString("pt-BR")}</span>
                {d.mood && <span className="rounded-full bg-ember/20 px-2 py-0.5 text-ember">{d.mood}</span>}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{d.raw_text}</p>
              {(d.symbols?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1">
                  {d.symbols!.map((s: string) => (
                    <span key={s} className="rounded-full border border-border px-2 py-0.5 text-[10px]">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {d.ai_interpretation && (
                <p className="border-l-2 border-ember pl-2 text-xs italic text-muted-foreground">
                  {d.ai_interpretation}
                </p>
              )}
            </article>
          ))
        )}
      </div>

    </MobileShell>
  );
}
