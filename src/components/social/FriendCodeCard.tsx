import { Copy, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";

export function FriendCodeCard({ code }: { code: string | null }) {
  if (!code) return null;
  const shareText = `Caminhe comigo no Weme. Meu código de viajante é ${code}.`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  return (
    <div className="rounded-2xl border border-ember/40 bg-ember/5 p-4">
      <p className="font-display text-[10px] tracking-[0.28em] text-ember">SEU CÓDIGO</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="font-display text-3xl tracking-[0.28em] text-foreground">{code}</span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            toast.success("Código copiado.");
          }}
          className="rounded-full border border-border p-2 text-muted-foreground transition hover:text-foreground"
          aria-label="Copiar código"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-[12px] font-display tracking-[0.18em] text-emerald-300"
        >
          <MessageCircle className="h-4 w-4" /> WHATSAPP
        </a>
        <button
          type="button"
          onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({ text: shareText });
              } catch {
                /* user cancelled */
              }
            } else {
              await navigator.clipboard.writeText(shareText);
              toast.success("Mensagem copiada.");
            }
          }}
          className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-[12px] font-display tracking-[0.18em] text-muted-foreground"
        >
          <Share2 className="h-4 w-4" /> COMPARTILHAR
        </button>
      </div>
    </div>
  );
}
