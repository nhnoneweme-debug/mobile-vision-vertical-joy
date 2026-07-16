import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Moon, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";

export const Route = createFileRoute("/_authenticated/preferencias-notificacoes")({
  head: () => ({
    meta: [
      { title: "Preferências de notificação — Personal IA" },
      { name: "description", content: "Escolha quais categorias de push receber e defina sua janela de silêncio." },
    ],
  }),
  component: PrefsPage,
});

type Prefs = {
  push_enabled: boolean;
  quiet_start: number;
  quiet_end: number;
  allow_mission: boolean;
  allow_ritual: boolean;
  allow_streak: boolean;
  allow_orientador: boolean;
  allow_social: boolean;
};

const DEFAULT: Prefs = {
  push_enabled: true,
  quiet_start: 23,
  quiet_end: 7,
  allow_mission: true,
  allow_ritual: true,
  allow_streak: true,
  allow_orientador: true,
  allow_social: true,
};

const CATEGORIES: Array<{ key: keyof Prefs; label: string; hint: string }> = [
  { key: "allow_mission", label: "Missões", hint: "Missões pendentes e do orientador" },
  { key: "allow_ritual", label: "Rituais", hint: "Ritual matinal e noturno" },
  { key: "allow_streak", label: "Streak", hint: "Sua brasa em risco" },
  { key: "allow_orientador", label: "Orientador", hint: "Envios do seu orientador" },
  { key: "allow_social", label: "Social", hint: "Amizades, reações e menções" },
];

function PrefsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("notification_prefs")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (data) setPrefs({ ...DEFAULT, ...data } as Prefs);
      setLoading(false);
    })();
  }, []);

  function toggle<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("no_user");
      const { error } = await supabase
        .from("notification_prefs")
        .upsert({ user_id: uid, ...prefs }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Preferências salvas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileShell>
      <div className="px-4 pt-4 pb-32">
        <header className="mb-4 flex items-center gap-2">
          <div>
            <p className="font-display text-[10px] tracking-[0.3em] text-ember">AJUSTES</p>
            <h1 className="font-display text-xl tracking-wide text-foreground">Preferências de push</h1>
          </div>
        </header>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl border border-border bg-card p-4">
              <label className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-display text-sm text-foreground">
                    <Bell className="h-4 w-4 text-ember" /> Push habilitado
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Interruptor mestre. Se desligar, nenhuma categoria envia push, mas as notificações continuam na caixa.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-ember"
                  checked={prefs.push_enabled}
                  onChange={(e) => toggle("push_enabled", e.target.checked)}
                />
              </label>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <p className="flex items-center gap-2 font-display text-sm text-foreground">
                <Moon className="h-4 w-4 text-indigo-400" /> Janela de silêncio
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Entre esses horários, nenhum push é enviado. Use igual para desativar.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-muted-foreground">Início</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
                    value={prefs.quiet_start}
                    onChange={(e) => toggle("quiet_start", Number(e.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {String(i).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-muted-foreground">Fim</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
                    value={prefs.quiet_end}
                    onChange={(e) => toggle("quiet_end", Number(e.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {String(i).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <p className="font-display text-sm text-foreground">Categorias</p>
              <div className="mt-2 divide-y divide-border">
                {CATEGORIES.map((c) => (
                  <label key={c.key} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{c.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.hint}</p>
                    </div>
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 accent-ember"
                      checked={Boolean(prefs[c.key])}
                      onChange={(e) => toggle(c.key, e.target.checked as never)}
                    />
                  </label>
                ))}
              </div>
            </section>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-ember py-3 font-display text-xs tracking-[0.25em] text-background disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? "SALVANDO…" : "SALVAR"}
            </button>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
