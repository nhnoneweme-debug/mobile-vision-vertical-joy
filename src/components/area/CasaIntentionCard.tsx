import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Home, Check, Pencil } from "lucide-react";
import { getCasaIntention, setCasaIntention } from "@/lib/area-extra";

export function CasaIntentionCard({ userId }: { userId: string }) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const i = await getCasaIntention(userId);
        if (i) {
          setSaved(i.text);
          setText(i.text);
        } else {
          setEditing(true);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [userId]);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const i = await setCasaIntention(userId, text);
      setSaved(i.text);
      setEditing(false);
      toast.success("Intenção da semana salva");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ember/30 bg-ember/5 p-4">
      <div className="flex items-center gap-2">
        <Home className="h-4 w-4 text-ember" />
        <p className="font-display text-[10px] tracking-[0.3em] text-ember">
          INTENÇÃO DA SEMANA
        </p>
      </div>

      {!editing && saved ? (
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="flex-1 text-sm leading-relaxed text-foreground">{saved}</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground"
            aria-label="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={180}
            placeholder="Ex: priorizar sono e desligar telas após 22h"
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ember focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{text.length}/180</span>
            <button
              type="button"
              onClick={handleSave}
              disabled={!text.trim() || saving}
              className="flex items-center gap-1.5 rounded-lg bg-ember px-3 py-1.5 font-display text-[11px] tracking-[0.2em] text-charcoal-900 disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              {saving ? "SALVANDO…" : "SALVAR"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
