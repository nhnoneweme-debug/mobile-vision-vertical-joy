import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Personal IA" },
      { name: "description", content: "Seu avatar e dados básicos." },
    ],
  }),
  component: PerfilPage,
});

type Profile = {
  display_name: string;
  behavioral_class: string;
  xp: number;
  streak: number;
};

function PerfilPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      if (active) setEmail(userData.user.email ?? null);
      const { data } = await supabase
        .from("profiles")
        .select("display_name, behavioral_class, xp, streak")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (active && data) setProfile(data as Profile);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Você saiu da jornada. Até logo.");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <MobileShell>
      <header
        className="border-b border-border px-4 pb-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <p className="font-display text-[10px] tracking-[0.4em] text-ember">PERFIL</p>
        <h1 className="mt-1 font-display text-3xl tracking-wide text-foreground">
          Seu avatar
        </h1>
      </header>

      <section className="px-4 py-6">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="ember-glow grid h-16 w-16 place-items-center rounded-2xl bg-charcoal-900">
              <span className="font-display text-2xl text-ember">
                {(profile?.display_name ?? "V").slice(0, 1).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-2xl leading-none tracking-wide text-foreground">
                {profile?.display_name ?? "Viajante"}
              </h2>
              <p className="mt-1 font-display text-[10px] tracking-[0.3em] text-ember">
                CLASSE · {(profile?.behavioral_class ?? "executor").toUpperCase()}
              </p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3">
            <Stat label="XP TOTAL" value={profile?.xp ?? 0} />
            <Stat label="STREAK" value={profile?.streak ?? 0} />
          </dl>

          {email && (
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-charcoal-900 px-3 py-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 text-ember" strokeWidth={2.2} />
              <span className="truncate">{email}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 py-4 font-display tracking-widest text-foreground active:scale-[0.99]"
        >
          <LogOut className="h-5 w-5 text-ember" strokeWidth={2.2} />
          SAIR DA JORNADA
        </button>
      </section>
    </MobileShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-charcoal-900 px-3 py-3">
      <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl leading-none text-ember">
        {value}
      </p>
    </div>
  );
}
