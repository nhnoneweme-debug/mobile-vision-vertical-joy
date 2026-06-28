import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Mail, RotateCcw, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import { ThemePicker } from "@/components/ThemePicker";
import { QuestHistory } from "@/components/profile/QuestHistory";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CLASS_META, type BehavioralClass } from "@/lib/behavior";
import { listRecentQuests, type DailyQuestRow } from "@/lib/quests";

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
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: string | null;
  level: string | null;
  time_per_day_min: number | null;
  days_per_week: number | null;
};

const GOAL_LABEL: Record<string, string> = {
  emagrecer: "Emagrecer",
  hipertrofia: "Hipertrofia",
  saude: "Saúde geral",
  performance: "Performance",
  mente: "Mente & hábitos",
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
        .select(
          "display_name, behavioral_class, xp, streak, age, gender, height_cm, weight_kg, goal, level, time_per_day_min, days_per_week",
        )
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

  async function handleRedoDiagnostic() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed: false })
      .eq("id", userData.user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/onboarding", replace: true });
  }

  const cls = (profile?.behavioral_class ?? "executor") as BehavioralClass;
  const meta = CLASS_META[cls] ?? CLASS_META.executor;

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
              <span className="text-3xl">{meta.emblem}</span>
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-2xl leading-none tracking-wide text-foreground">
                {profile?.display_name ?? "Viajante"}
              </h2>
              <p className="mt-1 font-display text-[10px] tracking-[0.3em] text-ember">
                CLASSE · {meta.name.toUpperCase()}
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

        {profile?.goal && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-ember" strokeWidth={2.2} />
              <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
                JORNADA ATUAL
              </p>
            </div>
            <p className="mt-2 font-display text-2xl tracking-wide text-foreground">
              {GOAL_LABEL[profile.goal] ?? profile.goal}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 font-display text-[11px] tracking-[0.2em] text-muted-foreground">
              <MiniStat label="NÍVEL" value={profile.level ?? "—"} />
              <MiniStat
                label="MIN/DIA"
                value={profile.time_per_day_min?.toString() ?? "—"}
              />
              <MiniStat
                label="DIAS/SEM"
                value={profile.days_per_week?.toString() ?? "—"}
              />
            </div>
            {(profile.age || profile.height_cm || profile.weight_kg) && (
              <div className="mt-3 grid grid-cols-3 gap-2 font-display text-[11px] tracking-[0.2em] text-muted-foreground">
                <MiniStat label="IDADE" value={profile.age?.toString() ?? "—"} />
                <MiniStat
                  label="ALTURA"
                  value={profile.height_cm ? `${profile.height_cm}cm` : "—"}
                />
                <MiniStat
                  label="PESO"
                  value={profile.weight_kg ? `${profile.weight_kg}kg` : "—"}
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          <ThemePicker />
        </div>

        <button
          type="button"
          onClick={handleRedoDiagnostic}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-ember/40 bg-charcoal-900 px-6 py-4 font-display tracking-widest text-ember active:scale-[0.99]"
        >
          <RotateCcw className="h-5 w-5" strokeWidth={2.2} />
          REFAZER DIAGNÓSTICO
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 py-4 font-display tracking-widest text-foreground active:scale-[0.99]"
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
      <p className="mt-1 font-display text-3xl leading-none text-ember">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-charcoal-900 px-2 py-2 text-center">
      <p className="text-[9px] tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-base tracking-wide text-foreground">
        {value}
      </p>
    </div>
  );
}
