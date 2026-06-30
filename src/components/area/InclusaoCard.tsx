import { useEffect, useState } from "react";
import { Loader2, Save, Accessibility } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_INCLUSION,
  getInclusionPrefs,
  saveInclusionPrefs,
  type InclusionPrefs,
} from "@/lib/area-extra";

const TONES: { value: InclusionPrefs["ia_tone"]; label: string }[] = [
  { value: "firme", label: "Firme" },
  { value: "acolhedor", label: "Acolhedor" },
  { value: "poetico", label: "Poético" },
  { value: "direto", label: "Direto" },
  { value: "leve", label: "Leve" },
];

const LEVELS: { value: InclusionPrefs["language_level"]; label: string }[] = [
  { value: "tecnico", label: "Técnico" },
  { value: "simples", label: "Simples" },
  { value: "muito_simples", label: "Muito simples" },
];

function applyAccessibility(prefs: InclusionPrefs) {
  const html = document.documentElement;
  html.classList.toggle("reduce-motion", prefs.accessibility.reduced_motion);
  html.classList.toggle("large-text", prefs.accessibility.large_text);
  html.classList.toggle("high-contrast", prefs.accessibility.high_contrast);
}

export function InclusaoCard({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<InclusionPrefs>(DEFAULT_INCLUSION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await getInclusionPrefs(userId);
        setPrefs(p);
        applyAccessibility(p);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao carregar");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await saveInclusionPrefs(userId, prefs);
      applyAccessibility(saved);
      toast.success("Preferências salvas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function toggleA11y(key: keyof InclusionPrefs["accessibility"]) {
    setPrefs((p) => ({
      ...p,
      accessibility: { ...p.accessibility, [key]: !p.accessibility[key] },
    }));
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-4 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex items-center gap-2">
        <Accessibility className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm tracking-[0.2em]">VOCÊ COMO VOCÊ É</h3>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Pronomes
        </label>
        <input
          value={prefs.pronouns}
          onChange={(e) => setPrefs({ ...prefs, pronouns: e.target.value })}
          placeholder="ela/dela · ele/dele · elu/delu …"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Identidade (opcional)
        </label>
        <textarea
          value={prefs.identity_note}
          onChange={(e) => setPrefs({ ...prefs, identity_note: e.target.value })}
          rows={2}
          placeholder="O que a IA precisa saber sobre quem você é?"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Acessibilidade
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["reduced_motion", "Reduzir animação"],
              ["large_text", "Texto maior"],
              ["high_contrast", "Alto contraste"],
              ["screen_reader", "Uso leitor de tela"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleA11y(key)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                prefs.accessibility[key]
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background/40 text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Tom da IA
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setPrefs({ ...prefs, ia_tone: t.value })}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                prefs.ia_tone === t.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Nível de linguagem
        </p>
        <div className="flex flex-wrap gap-1.5">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setPrefs({ ...prefs, language_level: l.value })}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                prefs.language_level === l.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Assuntos que a IA deve evitar
        </label>
        <textarea
          value={prefs.no_go_topics}
          onChange={(e) => setPrefs({ ...prefs, no_go_topics: e.target.value })}
          rows={2}
          placeholder="Ex.: dieta restritiva, comparação corporal, religião…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Crenças que te fortalecem
        </label>
        <textarea
          value={prefs.empowering_beliefs}
          onChange={(e) => setPrefs({ ...prefs, empowering_beliefs: e.target.value })}
          rows={2}
          placeholder="Frases / verdades suas que a IA pode reforçar"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar preferências
      </button>
    </div>
  );
}
