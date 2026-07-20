import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Compass, ListChecks, Sparkles } from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/despertar/planejar")({
  head: () => ({ meta: [{ title: "Planejar o dia — WiMi" }] }),
  component: PlanejarGate,
});

type ItemLite = { id: string; title: string; time: string | null };

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function PlanejarGate() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ItemLite[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        setItems([]);
        return;
      }
      const day = todayIso();
      const dow = new Date().getDay();
      const [{ data: missions }, { data: scheduled }] = await Promise.all([
        supabase
          .from("user_missions")
          .select("id,title,scheduled_time,weekday_mask,active")
          .eq("user_id", user.user.id)
          .eq("active", true),
        supabase
          .from("scheduled_quests")
          .select("id,title,scheduled_date")
          .eq("user_id", user.user.id)
          .eq("scheduled_date", day),
      ]);
      const missionItems: ItemLite[] = (missions ?? [])
        .filter((m) => {
          const mask = (m.weekday_mask as number | null) ?? 0;
          return mask === 0 || (mask & (1 << dow)) !== 0;
        })
        .map((m) => ({
          id: m.id as string,
          title: m.title as string,
          time: ((m.scheduled_time as string | null) ?? null)?.slice(0, 5) ?? null,
        }));
      const schedItems: ItemLite[] = (scheduled ?? []).map((s) => ({
        id: s.id as string,
        title: s.title as string,
        time: null,
      }));
      const merged = [...missionItems, ...schedItems].sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
      setItems(merged);
    })();
  }, []);

  if (items === null) {
    return (
      <MobileShell hideNav>
        <div className="p-6 text-sm text-muted-foreground">Verificando seu plano de hoje…</div>
      </MobileShell>
    );
  }

  const hasPlan = items.length > 0;

  return (
    <MobileShell hideNav>
      <div className="p-5 flex flex-col gap-5 min-h-[100dvh]">
        <header className="flex items-center gap-3">
          <Compass className="h-6 w-6 text-ember" strokeWidth={2} />
          <h1 className="font-display text-2xl tracking-wide">
            {hasPlan ? "Você já tem um plano" : "Vamos planejar seu dia"}
          </h1>
        </header>

        {hasPlan ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {items.length} compromisso{items.length > 1 ? "s" : ""} agendado{items.length > 1 ? "s" : ""} para hoje.
            </p>
            <ul className="flex flex-col gap-2 rounded-2xl border border-border bg-charcoal-900/60 p-3">
              {items.slice(0, 8).map((it) => (
                <li key={it.id} className="flex items-center gap-3 text-sm">
                  <span className="w-12 font-mono text-xs text-ember">{it.time ?? "--:--"}</span>
                  <span className="flex-1 truncate">{it.title}</span>
                </li>
              ))}
              {items.length > 8 && (
                <li className="text-xs text-muted-foreground">+ {items.length - 8} outros…</li>
              )}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            A agenda está livre. Quer construir o dia com a WiMi agora?
          </p>
        )}

        <div className="mt-auto flex flex-col gap-2 pb-[env(safe-area-inset-bottom)]">
          {hasPlan ? (
            <>
              <button
                type="button"
                onClick={() => navigate({ to: "/executar" })}
                className="flex items-center justify-center gap-2 rounded-xl bg-ember py-4 font-display tracking-wide text-primary-foreground ember-glow"
              >
                <ListChecks className="h-5 w-5" /> Ir executar
              </button>
              <Link
                to="/assistente"
                search={{ seed: "planejar-dia" } as never}
                className="rounded-xl border border-border py-3 text-center text-sm text-muted-foreground"
              >
                Ajustar com a WiMi
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/assistente"
                search={{ seed: "planejar-dia" } as never}
                className="flex items-center justify-center gap-2 rounded-xl bg-ember py-4 font-display tracking-wide text-primary-foreground ember-glow"
              >
                <Sparkles className="h-5 w-5" /> Planejar com a WiMi
              </Link>
              <button
                type="button"
                onClick={() => navigate({ to: "/executar" })}
                className="rounded-xl border border-border py-3 text-sm text-muted-foreground"
              >
                Pular por hoje
              </button>
            </>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
