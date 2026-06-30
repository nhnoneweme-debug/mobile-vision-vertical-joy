import { useEffect, useState } from "react";
import { Ban, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { listMyBlocks, unblockUser } from "@/lib/moderation";

export function BlockedListCard() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Awaited<ReturnType<typeof listMyBlocks>>>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await listMyBlocks());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();
  }, [open]);

  const remove = async (id: string) => {
    try {
      await unblockUser(id);
      toast.success("Desbloqueado.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-charcoal-900/30 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <span className="flex items-center gap-2 font-display text-[11px] tracking-[0.22em] text-ember">
          <ShieldCheck className="h-4 w-4" /> MODERAÇÃO · BLOQUEADOS
        </span>
        <span className="text-[10px] text-muted-foreground">{open ? "ocultar" : "abrir"}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-2">
          {loading ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Você não bloqueou ninguém. Use o menu (⋮) em cima de qualquer post para denunciar ou bloquear.
            </p>
          ) : (
            items.map((b) => (
              <div
                key={b.blocked_id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div className="text-xs text-foreground">
                  {b.display_name ?? "Viajante"}
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {new Date(b.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => remove(b.blocked_id)}
                  className="flex items-center gap-1 rounded-full border border-ember/40 px-3 py-1 text-[10px] font-display tracking-[0.18em] text-ember"
                >
                  <Ban className="h-3 w-3" /> DESBLOQUEAR
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
