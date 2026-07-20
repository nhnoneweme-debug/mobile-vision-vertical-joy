import { useEffect, useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NameSchema = z
  .string()
  .trim()
  .min(2, "Mínimo de 2 caracteres.")
  .max(40, "Máximo de 40 caracteres.")
  .regex(/^[\p{L}\p{N}\s.'’-]+$/u, "Use apenas letras, números e espaços.");

type Props = {
  userId: string | null;
  currentName: string;
  onSaved: (newName: string) => void;
};

/**
 * Edita apenas o rótulo `profiles.display_name`.
 * Todas as relações do banco usam `user_id` (UUID) como âncora — nenhuma
 * tabela referencia o nome como chave. Snapshots históricos (ex.:
 * `group_posts.author_name`) preservam o nome antigo no momento do post
 * de propósito e continuam válidos após a troca.
 */
export function EditNameDialog({ userId, currentName, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(currentName);
      setError(null);
    }
  }, [open, currentName]);

  async function handleSave() {
    if (!userId) return;
    const parsed = NameSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Nome inválido.");
      return;
    }
    const next = parsed.data;
    if (next === currentName) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: next })
      .eq("id", userId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    toast.success("Nome atualizado.");
    onSaved(next);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Editar nome"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-charcoal-900 text-ember active:scale-95"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar nome</DialogTitle>
          <DialogDescription>
            Só o rótulo exibido muda. Suas missões, XP, grupos e histórico
            continuam ligados a você — o vínculo é pelo seu ID, não pelo nome.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <Input
            autoFocus
            value={value}
            maxLength={40}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSave();
              }
            }}
            placeholder="Como quer ser chamado(a)"
          />
          {error && (
            <p className="mt-2 text-xs text-red-400" role="alert">
              {error}
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            2 a 40 caracteres. Letras, números, espaços e . ' -
          </p>
        </div>

        <DialogFooter className="mt-2 flex-row justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm text-muted-foreground active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !userId}
            className="flex items-center gap-2 rounded-xl border border-ember/40 bg-charcoal-900 px-4 py-2 font-display text-sm tracking-widest text-ember active:scale-95 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            SALVAR
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
