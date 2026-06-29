import { useRef, useState } from "react";
import { ImagePlus, Loader2, Send, Video, X } from "lucide-react";
import { toast } from "sonner";
import {
  createPost,
  uploadPostMedia,
  type MediaType,
  type VisibilityMode,
  type VisibilityRule,
} from "@/lib/feed";

const VISIBILITY_PRESETS: { value: VisibilityMode; label: string; rule: VisibilityRule; desc: string }[] = [
  { value: "auto", label: "AMIGOS", rule: { friends: true }, desc: "Só amigos aceitos" },
  { value: "auto", label: "AMIGOS+GUILDA", rule: { friends: true, guild: true }, desc: "Amigos e sua guilda" },
  { value: "auto", label: "CLASSE", rule: { class: true, friends: true }, desc: "Quem tem sua classe" },
  { value: "public", label: "PÚBLICO", rule: {}, desc: "Qualquer viajante" },
];

export function PostComposer({ userId, onPosted }: { userId: string; onPosted?: () => void }) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!body.trim() && !file) {
      toast.error("Escreva algo ou anexe mídia.");
      return;
    }
    setBusy(true);
    try {
      let mediaPath: string | null = null;
      let mediaType: MediaType = "none";
      if (file) {
        if (file.type.startsWith("video/")) {
          const dur = await videoDuration(file);
          if (dur > 31) throw new Error("Vídeo precisa ter até 30s.");
        }
        const up = await uploadPostMedia(userId, file);
        mediaPath = up.path;
        mediaType = up.type;
      }
      const sel = VISIBILITY_PRESETS[preset];
      await createPost({
        body,
        mediaPath,
        mediaType,
        visibilityMode: sel.value,
        visibilityRule: sel.rule,
      });
      setBody("");
      setFile(null);
      toast.success("Publicado.");
      onPosted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao publicar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-charcoal-900/40 p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Compartilhe sua brasa do dia..."
        rows={3}
        className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      {file ? (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-border bg-charcoal-900/60 px-3 py-2 text-xs text-muted-foreground">
          <span className="truncate">{file.name}</span>
          <button type="button" onClick={() => setFile(null)} aria-label="Remover">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {VISIBILITY_PRESETS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setPreset(i)}
            className={
              "rounded-full border px-3 py-1 font-display text-[10px] tracking-[0.18em] transition " +
              (preset === i
                ? "border-ember bg-ember/10 text-ember"
                : "border-border text-muted-foreground")
            }
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Visibilidade: {VISIBILITY_PRESETS[preset].desc}
      </p>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-full border border-border p-2 text-muted-foreground"
            aria-label="Anexar mídia"
          >
            {file?.type.startsWith("video/") ? (
              <Video className="h-4 w-4" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="flex items-center gap-2 rounded-full bg-ember px-5 py-2 font-display text-[11px] tracking-[0.18em] text-charcoal-900 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          PUBLICAR
        </button>
      </div>
    </div>
  );
}

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      resolve(v.duration);
    };
    v.onerror = () => reject(new Error("Falha ao ler vídeo."));
    v.src = URL.createObjectURL(file);
  });
}
