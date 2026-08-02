// REGISTRAR — o jeito rápido de colocar algo REAL na timeline de hoje.
//
// Três modos, todos gravando o mesmo evento append-only (`manual_log`):
//   MIC    → fala transcrita pelo mesmo pipeline dos ouvidos (DualInput)
//   CÂMERA → foto capturada e guardada no bucket privado `execution-media`
//   DUMP   → despejo de texto livre, sem estrutura nenhuma
//
// Nada aqui é planejamento: só registro do que aconteceu.

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Loader2, Mic, NotebookPen, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { DualInput } from "./DualInput";
import { useCamera } from "@/hooks/useCamera";
import { supabase } from "@/integrations/supabase/client";
import { logExecutionEvent } from "@/lib/execution.functions";

export type RegisterMode = "mic" | "camera" | "dump";

const MODES: { key: RegisterMode; label: string; icon: typeof Mic }[] = [
  { key: "mic", label: "Falar", icon: Mic },
  { key: "camera", label: "Foto", icon: Camera },
  { key: "dump", label: "Dump", icon: NotebookPen },
];

export function RegisterSheet({
  initialMode = "mic",
  missionId = null,
  sessionId = null,
  onClose,
}: {
  initialMode?: RegisterMode;
  missionId?: string | null;
  sessionId?: string | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<RegisterMode>(initialMode);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const camera = useCamera();
  const qc = useQueryClient();
  const shotRef = useRef<string | null>(null);

  // A câmera só liga quando o modo foto está na tela — e morre ao sair.
  useEffect(() => {
    if (mode === "camera" && !shot) void camera.start();
    if (mode !== "camera") camera.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, shot]);

  useEffect(() => () => camera.stop(), [camera.stop]);
  useEffect(() => {
    shotRef.current = shot?.url ?? null;
    return () => {
      if (shotRef.current) URL.revokeObjectURL(shotRef.current);
    };
  }, [shot]);

  async function takeShot() {
    const blob = await camera.capture();
    if (!blob) {
      toast.error("Não consegui capturar o quadro. A câmera está aberta?");
      return;
    }
    setShot({ blob, url: URL.createObjectURL(blob) });
    camera.stop();
  }

  async function uploadShot(blob: Blob): Promise<string> {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error("Sessão expirada — entre de novo.");
    const path = `${uid}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from("execution-media")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error(error.message);
    return path;
  }

  async function save() {
    const body = text.trim();
    if (mode !== "camera" && !body) {
      toast.info("Escreva ou fale alguma coisa primeiro.");
      return;
    }
    if (mode === "camera" && !shot) {
      toast.info("Capture a foto antes de registrar.");
      return;
    }
    setSaving(true);
    try {
      const storage_path = mode === "camera" && shot ? await uploadShot(shot.blob) : null;
      await logExecutionEvent({
        data: {
          mission_id: missionId,
          kind: "manual_log",
          channel: mode === "mic" ? "voice" : "manual",
          note: (body || (mode === "camera" ? "foto registrada" : "")).slice(0, 4000),
          meta: {
            mode,
            session_id: sessionId,
            ...(storage_path ? { storage_path, caption: body || null } : {}),
            ...(mode !== "camera" ? { text: body } : {}),
          },
        },
      });
      void qc.invalidateQueries({ queryKey: ["execution-log"] });
      toast.success("Registrado na timeline de hoje.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui registrar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal-950/70 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-[var(--shell-max,480px)] overflow-y-auto rounded-t-3xl border-t border-ember/40 bg-charcoal-900 p-5 pb-8">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg tracking-wide">REGISTRAR</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Só o que aconteceu de verdade — vai direto pra timeline de hoje.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="shrink-0 rounded-full border border-border p-1.5 text-muted-foreground active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {MODES.map((m) => {
            const Icon = m.icon;
            const on = mode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                aria-pressed={on}
                className={`inline-flex min-w-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs transition active:scale-95 ${
                  on
                    ? "bg-ember/15 text-ember ring-1 ring-ember/40"
                    : "text-muted-foreground ring-1 ring-border"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </div>

        {mode === "camera" ? (
          <div className="mt-4 space-y-3">
            <div className="overflow-hidden rounded-2xl border border-border bg-charcoal-950/60">
              {shot ? (
                <img src={shot.url} alt="Foto registrada agora" className="w-full" />
              ) : (
                <video
                  ref={camera.attach}
                  muted
                  playsInline
                  className="aspect-[3/4] w-full bg-charcoal-950 object-cover"
                />
              )}
            </div>
            {!shot && camera.status !== "live" ? (
              <p className="text-[11px] text-muted-foreground">
                {camera.status === "denied"
                  ? "Permissão de câmera negada — libere nas configurações do navegador."
                  : camera.status === "unsupported"
                    ? "Este navegador não expõe a câmera."
                    : camera.error
                      ? camera.error
                      : "Abrindo a câmera…"}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {shot ? (
                <button
                  type="button"
                  onClick={() => {
                    setShot(null);
                    void camera.start();
                  }}
                  className="inline-flex min-w-0 items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground active:scale-95"
                >
                  <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Refazer</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!camera.live}
                    onClick={() => void takeShot()}
                    className="inline-flex min-w-0 items-center gap-2 rounded-full border border-ember/40 bg-ember/10 px-3 py-1.5 text-xs text-ember disabled:opacity-40 active:scale-95"
                  >
                    <Camera className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Capturar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void camera.flip()}
                    className="inline-flex min-w-0 items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground active:scale-95"
                  >
                    <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Virar</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <DualInput
            value={text}
            onChange={setText}
            rows={mode === "camera" ? 2 : 4}
            placeholder={
              mode === "mic"
                ? "Fale o registro — eu transcrevo."
                : mode === "camera"
                  ? "Legenda (opcional) — fale ou escreva."
                  : "Despeje aqui, cru, sem organizar."
            }
          />
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-ember/40 bg-ember/10 py-2.5 text-sm text-ember disabled:opacity-40 active:scale-95"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Registrar agora
        </button>
      </div>
    </div>
  );
}
