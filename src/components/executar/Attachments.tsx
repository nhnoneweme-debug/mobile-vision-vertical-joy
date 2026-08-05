// ANEXOS DO EXECUTANDO — arquivo, imagem e vídeo em qualquer composer.
//
// Regras da camada 3.9:
//  - antes do envio, o anexo aparece como CHIP compacto (nome + tamanho + remover)
//  - depois do envio, aparece no fluxo como CARD discreto com miniatura
//  - upload vai pro bucket privado `execution-media`, na pasta do próprio usuário
//    (RLS já garante que ninguém lê a pasta do outro)

import { useRef } from "react";
import { FileText, Film, ImageIcon, Paperclip, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type AttachmentKind = "image" | "video" | "file";

export type PendingAttachment = {
  id: string;
  file: File;
  name: string;
  size: number;
  mime: string;
  kind: AttachmentKind;
  /** object URL local — só existe enquanto a aba está aberta */
  previewUrl?: string;
};

export type AttachmentRef = {
  path: string;
  name: string;
  size: number;
  mime: string;
  kind: AttachmentKind;
  /** miniatura local da sessão (não persistida) */
  previewUrl?: string;
};

export const ATTACH_ACCEPT = "image/*,video/*,.pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx";

function kindOf(mime: string): AttachmentKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function makePending(files: FileList | File[]): PendingAttachment[] {
  return Array.from(files).map((file) => {
    const mime = file.type || "application/octet-stream";
    const kind = kindOf(mime);
    return {
      id: newId(),
      file,
      name: file.name,
      size: file.size,
      mime,
      kind,
      previewUrl: kind === "image" || kind === "video" ? URL.createObjectURL(file) : undefined,
    };
  });
}

export function releasePending(list: PendingAttachment[]) {
  for (const a of list) if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
}

/** Sobe tudo pro bucket privado do usuário e devolve as referências. */
export async function uploadAttachments(list: PendingAttachment[]): Promise<AttachmentRef[]> {
  if (list.length === 0) return [];
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sessão expirada — entre de novo.");
  const day = new Date().toISOString().slice(0, 10);
  const out: AttachmentRef[] = [];
  for (const a of list) {
    const ext = a.name.includes(".") ? a.name.slice(a.name.lastIndexOf(".") + 1) : "bin";
    const path = `${uid}/${day}/${newId()}.${ext}`;
    const { error } = await supabase.storage
      .from("execution-media")
      .upload(path, a.file, { contentType: a.mime, upsert: false });
    if (error) throw new Error(error.message);
    out.push({
      path,
      name: a.name,
      size: a.size,
      mime: a.mime,
      kind: a.kind,
      ...(a.previewUrl ? { previewUrl: a.previewUrl } : {}),
    });
  }
  return out;
}

function IconFor({ kind, className }: { kind: AttachmentKind; className?: string }) {
  if (kind === "image") return <ImageIcon className={className} />;
  if (kind === "video") return <Film className={className} />;
  return <FileText className={className} />;
}

/** Botão de anexar — abre o seletor nativo (arquivo, imagem ou vídeo). */
export function AttachButton({
  onPick,
  disabled,
  label = "Anexar arquivo, imagem ou vídeo",
}: {
  onPick: (files: PendingAttachment[]) => void;
  disabled?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        accept={ATTACH_ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onPick(makePending(e.target.files));
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        onClick={() => ref.current?.click()}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground disabled:opacity-40 active:scale-95"
      >
        <Paperclip className="h-4 w-4" />
      </button>
    </>
  );
}

/** Chips compactos no composer, antes do envio. */
export function AttachChips({
  items,
  onRemove,
}: {
  items: PendingAttachment[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((a) => (
        <span
          key={a.id}
          className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-border bg-charcoal-950/60 px-2 py-1 text-[11px] text-muted-foreground"
        >
          <IconFor kind={a.kind} className="h-3 w-3 shrink-0 text-ember" />
          <span className="min-w-0 max-w-[120px] truncate">{a.name}</span>
          <span className="shrink-0 opacity-70">{humanSize(a.size)}</span>
          <button
            type="button"
            aria-label={`Remover ${a.name}`}
            onClick={() => onRemove(a.id)}
            className="shrink-0 active:scale-95"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

/** Cards discretos no fluxo, depois do envio. Nunca inline gigante. */
export function AttachmentCards({ items }: { items: AttachmentRef[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {items.map((a) => (
        <span
          key={a.path}
          className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-border/60 bg-charcoal-950/50 px-2 py-1"
        >
          {a.previewUrl && a.kind === "image" ? (
            <img
              src={a.previewUrl}
              alt={a.name}
              className="h-7 w-7 shrink-0 rounded object-cover"
              loading="lazy"
            />
          ) : (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-charcoal-900 text-ember">
              <IconFor kind={a.kind} className="h-3.5 w-3.5" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block max-w-[140px] truncate text-[11px] text-foreground">
              {a.name}
            </span>
            <span className="block text-[10px] text-muted-foreground">{humanSize(a.size)}</span>
          </span>
        </span>
      ))}
    </div>
  );
}
