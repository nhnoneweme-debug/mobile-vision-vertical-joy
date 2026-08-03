// STUDIO DE PERSONAS (Camada 3.8) — o usuário define COMO Wi e Mi se manifestam,
// testa antes de salvar, e exporta/importa o modelo como bloco social.

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  Loader2,
  Play,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/shell/MobileShell";
import { personaPreview } from "@/lib/persona-studio.functions";
import {
  activatePersonaProfile,
  buildPersonaDirective,
  defaultPersonaModel,
  deletePersonaProfile,
  downloadPersonaModel,
  listPersonaProfiles,
  parsePersonaModel,
  PERSONA_PRESETS,
  savePersonaProfile,
  type PersonaModel,
  type PersonaProfile,
  type PersonaSpec,
  type RoutingRules,
} from "@/lib/persona-studio";
import { PERSONA_LABEL, type Persona, type PersonaChoice } from "@/lib/personas";
import { speakUnified } from "@/lib/tts-engine";

export const Route = createFileRoute("/_authenticated/personas")({
  head: () => ({
    meta: [
      { title: "Studio de Personas — WiMi" },
      {
        name: "description",
        content:
          "Configure como Wi e Mi se manifestam: tom, voz, instruções e regras de roteamento. Exporte e importe modelos.",
      },
      { property: "og:title", content: "Studio de Personas — WiMi" },
      {
        property: "og:description",
        content: "Modelos de persona exportáveis: quando mais Wi, quando mais Mi, o quanto e como.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PersonasPage,
});

const SERVER_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

const FIELD =
  "w-full rounded-xl border border-border bg-charcoal-950/60 px-3 py-2 text-[13px] text-foreground outline-none focus:border-ember/50";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-[11px] active:scale-95 ${
        active ? "border-ember bg-ember/15 text-ember" : "border-border text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function PersonasPage() {
  const [model, setModel] = useState<PersonaModel>(() => defaultPersonaModel());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<PersonaProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [question, setQuestion] = useState("Como eu retomo o bloco que travei hoje?");
  const [preview, setPreview] = useState<{
    persona: Persona;
    message: string;
    why: string;
    reply_lang: string | null;
  } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState<PersonaModel | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      setProfiles(await listPersonaProfiles());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar modelos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const directive = useMemo(() => buildPersonaDirective(model), [model]);

  const patchSpec = (persona: Persona, patch: Partial<PersonaSpec>) =>
    setModel((m) => ({ ...m, [persona]: { ...m[persona], ...patch } }));

  const patchRouting = (patch: Partial<RoutingRules>) =>
    setModel((m) => ({ ...m, routing: { ...m.routing, ...patch } }));

  const save = async () => {
    if (!model.name.trim()) {
      toast.error("Dê um nome ao modelo.");
      return;
    }
    setSaving(true);
    try {
      const id = await savePersonaProfile(model, editingId);
      setEditingId(id);
      await refresh();
      toast.success("Modelo salvo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    if (!question.trim()) return;
    setPreviewBusy(true);
    setPreview(null);
    try {
      const res = await personaPreview({
        data: { directive, question: question.trim().slice(0, 1000) },
      });
      setPreview({
        persona: res.persona,
        message: res.message,
        why: res.why,
        reply_lang: res.reply_lang,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na prévia.");
    } finally {
      setPreviewBusy(false);
    }
  };

  const onImportFile = async (file: File) => {
    try {
      const parsed = parsePersonaModel(JSON.parse(await file.text()));
      setPendingImport(parsed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Arquivo inválido.");
    }
  };

  const sample = (persona: Persona) =>
    void speakUnified(
      `${model[persona].label} aqui. ${persona === "wi" ? "Vamos retomar juntos, um passo de cada vez." : "Vamos direto ao ponto: o que você decide agora?"}`,
      { lang: "pt-BR", voice: model[persona].server_voice },
    );

  return (
    <MobileShell>
      <div className="space-y-4 pb-24">
        <header>
          <h1 className="font-display text-xl tracking-wide text-foreground">
            Studio de Personas
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Defina como <strong>Wi</strong> (tutora) e <strong>Mi</strong> (mentor) se manifestam —
            quando cada uma aparece, o quanto, onde e como. O modelo ativo passa a alimentar o
            roteamento e o prompt de todas as manifestações.
          </p>
        </header>

        {/* BIBLIOTECA DE MODELOS */}
        <section className="rounded-2xl border border-border bg-charcoal-900/60 p-4">
          <h2 className="flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Biblioteca de modelos
          </h2>
          <div className="mt-3 space-y-2">
            {PERSONA_PRESETS.map((p) => (
              <div key={p.key} className="rounded-xl border border-border/60 bg-charcoal-950/30 p-3">
                <p className="text-sm text-foreground">{p.title}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">{p.description}</p>
                <button
                  type="button"
                  onClick={() => {
                    setModel(structuredClone(p.model));
                    setEditingId(null);
                    setPreview(null);
                    toast.success(`Preset "${p.title}" carregado — edite e salve.`);
                  }}
                  className="mt-2 rounded-full border border-ember/50 px-3 py-1 text-[11px] text-ember active:scale-95"
                >
                  aplicar
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* EDITOR */}
        <section className="space-y-3 rounded-2xl border border-border bg-charcoal-900/60 p-4">
          <h2 className="font-display text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Modelo
          </h2>
          <input
            value={model.name}
            onChange={(e) => setModel((m) => ({ ...m, name: e.target.value }))}
            placeholder="nome do modelo"
            className={FIELD}
          />
          <textarea
            value={model.intent}
            onChange={(e) => setModel((m) => ({ ...m, intent: e.target.value }))}
            placeholder="intuito: para que serve este modelo"
            rows={2}
            className={FIELD}
          />

          {(["wi", "mi"] as const).map((persona) => (
            <div
              key={persona}
              className="space-y-2 rounded-xl border border-border/60 bg-charcoal-950/30 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-sm tracking-wide text-foreground">
                  {PERSONA_LABEL[persona]} · {model[persona].role}
                </p>
                <button
                  type="button"
                  onClick={() => sample(persona)}
                  className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground active:scale-95"
                >
                  <Volume2 className="h-3.5 w-3.5" /> amostra
                </button>
              </div>
              <input
                value={model[persona].label}
                onChange={(e) => patchSpec(persona, { label: e.target.value })}
                placeholder="nome exibido"
                className={FIELD}
              />
              <input
                value={model[persona].role}
                onChange={(e) => patchSpec(persona, { role: e.target.value })}
                placeholder="papel"
                className={FIELD}
              />
              <input
                value={model[persona].tone}
                onChange={(e) => patchSpec(persona, { tone: e.target.value })}
                placeholder="tom"
                className={FIELD}
              />
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] text-muted-foreground">voz</span>
                {SERVER_VOICES.map((v) => (
                  <Chip
                    key={v}
                    active={model[persona].server_voice === v}
                    onClick={() => patchSpec(persona, { server_voice: v })}
                  >
                    {v}
                  </Chip>
                ))}
              </div>
              <textarea
                value={model[persona].instructions}
                onChange={(e) => patchSpec(persona, { instructions: e.target.value })}
                placeholder="instruções de comportamento"
                rows={3}
                className={FIELD}
              />
            </div>
          ))}
        </section>

        {/* ROTEAMENTO */}
        <section className="space-y-3 rounded-2xl border border-border bg-charcoal-900/60 p-4">
          <h2 className="font-display text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Regras de roteamento
          </h2>

          <div>
            <p className="text-[12px] text-muted-foreground">
              proporção: {model.routing.wi_share}% Wi · {100 - model.routing.wi_share}% Mi
            </p>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={model.routing.wi_share}
              onChange={(e) => patchRouting({ wi_share: Number(e.target.value) })}
              className="mt-1 w-full accent-ember"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">o quanto</span>
            {(["leve", "media", "forte"] as const).map((i) => (
              <Chip
                key={i}
                active={model.routing.intensity === i}
                onClick={() => patchRouting({ intensity: i })}
              >
                {i}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">onde</span>
            {(
              [
                ["live_chat", "chat do ouvido"],
                ["rituals", "rituais"],
                ["triggers", "gatilhos"],
              ] as const
            ).map(([k, label]) => (
              <Chip
                key={k}
                active={model.routing.surfaces[k]}
                onClick={() =>
                  patchRouting({
                    surfaces: { ...model.routing.surfaces, [k]: !model.routing.surfaces[k] },
                  })
                }
              >
                {label}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">como</span>
            {(["curta", "media", "longa"] as const).map((l) => (
              <Chip
                key={l}
                active={model.routing.style.length === l}
                onClick={() => patchRouting({ style: { ...model.routing.style, length: l } })}
              >
                {l}
              </Chip>
            ))}
            {(["direto", "acolhedor", "equilibrado"] as const).map((a) => (
              <Chip
                key={a}
                active={model.routing.style.approach === a}
                onClick={() => patchRouting({ style: { ...model.routing.style, approach: a } })}
              >
                {a}
              </Chip>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">quando (contexto → identidade)</p>
            {model.routing.contexts.map((c, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-1.5">
                <input
                  value={c.context}
                  onChange={(e) =>
                    patchRouting({
                      contexts: model.routing.contexts.map((x, i) =>
                        i === idx ? { ...x, context: e.target.value } : x,
                      ),
                    })
                  }
                  className={`${FIELD} min-w-0 flex-1`}
                />
                {(["wi", "mi", "auto"] as PersonaChoice[]).map((p) => (
                  <Chip
                    key={p}
                    active={c.persona === p}
                    onClick={() =>
                      patchRouting({
                        contexts: model.routing.contexts.map((x, i) =>
                          i === idx ? { ...x, persona: p } : x,
                        ),
                      })
                    }
                  >
                    {p}
                  </Chip>
                ))}
                <button
                  type="button"
                  aria-label="remover contexto"
                  onClick={() =>
                    patchRouting({
                      contexts: model.routing.contexts.filter((_, i) => i !== idx),
                    })
                  }
                  className="rounded-lg border border-border p-1.5 text-muted-foreground active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                patchRouting({
                  contexts: [...model.routing.contexts, { context: "", persona: "auto" }],
                })
              }
              className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground active:scale-95"
            >
              + contexto
            </button>
          </div>

          <textarea
            value={model.routing.notes}
            onChange={(e) => patchRouting({ notes: e.target.value })}
            placeholder="regras extras em texto livre"
            rows={2}
            className={FIELD}
          />
        </section>

        {/* PRÉVIA */}
        <section className="space-y-2 rounded-2xl border border-border bg-charcoal-900/60 p-4">
          <h2 className="font-display text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Prévia (antes de salvar)
          </h2>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            className={FIELD}
            placeholder="pergunta de teste"
          />
          <button
            type="button"
            onClick={() => void runPreview()}
            disabled={previewBusy}
            className="flex items-center gap-2 rounded-xl border border-ember/50 px-3 py-2 text-[12px] text-ember disabled:opacity-50 active:scale-95"
          >
            {previewBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            testar
          </button>
          {preview ? (
            <div className="rounded-xl border border-ember/30 bg-ember/5 p-3">
              <p className="font-display text-[11px] uppercase tracking-[0.16em] text-ember">
                {PERSONA_LABEL[preview.persona]}
                {preview.reply_lang ? ` · ${preview.reply_lang}` : ""}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground">
                {preview.message}
              </p>
              {preview.why ? (
                <p className="mt-2 text-[11px] text-muted-foreground">{preview.why}</p>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* AÇÕES */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="ember-glow flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-display text-[12px] tracking-[0.16em] text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            SALVAR
          </button>
          <button
            type="button"
            onClick={() => downloadPersonaModel(model)}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-[12px] text-muted-foreground active:scale-95"
          >
            <Download className="h-4 w-4" /> exportar
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-[12px] text-muted-foreground active:scale-95"
          >
            <Upload className="h-4 w-4" /> importar
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onImportFile(f);
            }}
          />
        </div>

        {/* PRÉVIA DA IMPORTAÇÃO */}
        {pendingImport ? (
          <section className="space-y-2 rounded-2xl border border-ember/40 bg-ember/5 p-4">
            <h2 className="font-display text-[11px] uppercase tracking-[0.16em] text-ember">
              Importar modelo
            </h2>
            <p className="text-sm text-foreground">{pendingImport.name}</p>
            <p className="text-[12px] text-muted-foreground">{pendingImport.intent}</p>
            <p className="text-[12px] text-muted-foreground">
              {pendingImport.routing.wi_share}% Wi · {100 - pendingImport.routing.wi_share}% Mi ·
              intensidade {pendingImport.routing.intensity} · {pendingImport.routing.style.length},{" "}
              {pendingImport.routing.style.approach}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setModel(pendingImport);
                  setEditingId(null);
                  setPendingImport(null);
                  toast.success("Modelo restaurado no editor — salve para persistir.");
                }}
                className="rounded-xl border border-ember px-3 py-2 text-[12px] text-ember active:scale-95"
              >
                aplicar
              </button>
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                className="rounded-xl border border-border px-3 py-2 text-[12px] text-muted-foreground active:scale-95"
              >
                cancelar
              </button>
            </div>
          </section>
        ) : null}

        {/* MEUS MODELOS */}
        <section className="space-y-2 rounded-2xl border border-border bg-charcoal-900/60 p-4">
          <h2 className="font-display text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Meus modelos
          </h2>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : profiles.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">
              Nenhum modelo salvo — o preset padrão "Equilíbrio" segue valendo.
            </p>
          ) : (
            profiles.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-charcoal-950/30 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    {p.name} {p.is_active ? <span className="text-ember">· ativo</span> : null}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{p.intent}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModel({
                      schema_version: p.schema_version,
                      name: p.name,
                      intent: p.intent,
                      wi: p.wi,
                      mi: p.mi,
                      routing: p.routing,
                    });
                    setEditingId(p.id);
                  }}
                  className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground active:scale-95"
                >
                  editar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await activatePersonaProfile(p.id);
                      await refresh();
                      toast.success("Modelo ativado.");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Falha ao ativar.");
                    }
                  }}
                  className="flex items-center gap-1 rounded-full border border-ember/50 px-3 py-1 text-[11px] text-ember active:scale-95"
                >
                  <Check className="h-3 w-3" /> ativar
                </button>
                <button
                  type="button"
                  aria-label="apagar modelo"
                  onClick={async () => {
                    try {
                      await deletePersonaProfile(p.id);
                      if (editingId === p.id) setEditingId(null);
                      await refresh();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Falha ao apagar.");
                    }
                  }}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </section>
      </div>
    </MobileShell>
  );
}
