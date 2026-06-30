import { useRef, useState } from "react";
import { CalendarPlus, ImagePlus, Loader2, Send, Video, X } from "lucide-react";
import { toast } from "sonner";
import {
  createPost,
  uploadPostMedia,
  type MediaType,
  type VisibilityMode,
  type VisibilityRule,
} from "@/lib/feed";
import { attachEventToPost } from "@/lib/post-events";

const VISIBILITY_PRESETS: { value: VisibilityMode; label: string; rule: VisibilityRule; desc: string }[] = [
  { value: "auto", label: "AMIGOS", rule: { friends: true }, desc: "Só amigos aceitos" },
  { value: "auto", label: "AMIGOS+GUILDA", rule: { friends: true, guild: true }, desc: "Amigos e sua guilda" },
  { value: "auto", label: "CLASSE", rule: { class: true, friends: true }, desc: "Quem tem sua classe" },
  { value: "public", label: "PÚBLICO", rule: {}, desc: "Qualquer viajante" },
];

type Mode = "post" | "event";

export function PostComposer({ userId, onPosted }: { userId: string; onPosted?: () => void }) {
  const [mode, setMode] = useState<Mode>("post");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Event fields
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventCapacity, setEventCapacity] = useState("");

  const submit = async () => {
    if (mode === "event") {
      if (!eventTitle.trim()) return toast.error("Dê um título ao evento.");
      if (!eventDate || !eventTime) return toast.error("Defina data e hora.");
    } else if (!body.trim() && !file) {
      return toast.error("Escreva algo ou anexe mídia.");
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
      const postId = await createPost({
        body: mode === "event" ? body || eventTitle : body,
        mediaPath,
        mediaType,
        visibilityMode: sel.value,
        visibilityRule: sel.rule,
      });
      if (mode === "event") {
        const startsAt = new Date(`${eventDate}T${eventTime}`).toISOString();
        await attachEventToPost({
          postId,
          title: eventTitle,
          startsAt,
          locationText: eventLocation || null,
          capacity: eventCapacity ? Number(eventCapacity) : null,
        });
      }
      setBody("");
      setFile(null);
      setEventTitle("");
      setEventDate("");
      setEventTime("");
      setEventLocation("");
      setEventCapacity("");
      toast.success(mode === "event" ? "Evento criado." : "Publicado.");
      onPosted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao publicar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-charcoal-900/40 p-4">
      <div className="mb-3 flex gap-2">
        {(["post", "event"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={
              "flex items-center gap-1 rounded-full border px-3 py-1 font-display text-[10px] tracking-[0.2em] transition " +
              (mode === m
                ? "border-ember bg-ember/10 text-ember"
                : "border-border text-muted-foreground")
            }
          >
            {m === "event" ? <CalendarPlus className="h-3 w-3" /> : null}
            {m === "post" ? "POST" : "EVENTO"}
          </button>
        ))}
      </div>

      {mode === "event" ? (
        <div className="space-y-2">
          <input
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            placeholder="Título do evento"
            className="w-full rounded-lg border border-border bg-charcoal-900/60 px-3 py-2 text-sm text-foreground outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="rounded-lg border border-border bg-charcoal-900/60 px-3 py-2 text-sm text-foreground outline-none"
            />
            <input
              type="time"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
              className="rounded-lg border border-border bg-charcoal-900/60 px-3 py-2 text-sm text-foreground outline-none"
            />
          </div>
          <input
            value={eventLocation}
            onChange={(e) => setEventLocation(e.target.value)}
            placeholder="Local (opcional)"
            className="w-full rounded-lg border border-border bg-charcoal-900/60 px-3 py-2 text-sm text-foreground outline-none"
          />
          <input
            type="number"
            min={1}
            value={eventCapacity}
            onChange={(e) => setEventCapacity(e.target.value)}
            placeholder="Capacidade (opcional)"
            className="w-full rounded-lg border border-border bg-charcoal-900/60 px-3 py-2 text-sm text-foreground outline-none"
          />
        </div>
      ) : null}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={mode === "event" ? "Descrição do evento..." : "Compartilhe sua brasa do dia..."}
        rows={3}
        className="mt-2 w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
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
          {mode === "event" ? "CRIAR EVENTO" : "PUBLICAR"}
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
