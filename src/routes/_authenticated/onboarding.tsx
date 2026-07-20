import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { AvatarStep, type AvatarData } from "@/components/onboarding/AvatarStep";
import { GoalStep, type GoalData } from "@/components/onboarding/GoalStep";
import { BehaviorStep } from "@/components/onboarding/BehaviorStep";
import { OracleReveal } from "@/components/onboarding/OracleReveal";
import { BEHAVIOR_QUESTIONS, computeBehavior } from "@/lib/behavior";
import { seedHabitsForClass } from "@/lib/habits";
import { COUNTRIES, formatE164 } from "@/lib/countries";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — Weme" },
      { name: "description", content: "Defina seu avatar, objetivo e classe." },
    ],
  }),
  component: OnboardingPage,
});

type Step = 0 | 1 | 2 | 3;

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);

  const [avatar, setAvatar] = useState<AvatarData>({ display_name: "" });
  const [goal, setGoal] = useState<GoalData>({});
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [phoneError, setPhoneError] = useState<string | null>(null);


  // Pré-popula nome/telefone do profile e dos metadados de SSO
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const meta = userData.user.user_metadata ?? {};
      const ssoName = (meta.full_name || meta.name || "") as string;
      const ssoPhone = (userData.user.phone || "") as string;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, phone, phone_country, onboarding_completed")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (!active) return;
      if (data?.onboarding_completed) {
        navigate({ to: "/home", replace: true });
        return;
      }
      setAvatar((a) => ({
        ...a,
        display_name: a.display_name || data?.display_name || ssoName || "",
        phone_number: a.phone_number || data?.phone || ssoPhone || "",
        phone_country: a.phone_country || data?.phone_country || "BR",
      }));
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  const result = useMemo(() => computeBehavior(answers), [answers]);

  const canNext = (() => {
    if (step === 0) return Boolean(avatar.display_name.trim());
    if (step === 1)
      return Boolean(
        goal.goal && goal.level && goal.time_per_day_min && goal.days_per_week,
      );
    if (step === 2)
      return BEHAVIOR_QUESTIONS.every((q) => typeof answers[q.id] === "number");
    return true;
  })();

  function back() {
    if (step === 0) return;
    setStep((s) => (s - 1) as Step);
  }

  function next() {
    if (!canNext) return;
    setStep((s) => (s + 1) as Step);
  }

  async function finish() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sessão expirada.");
      const dial =
        COUNTRIES.find((c) => c.code === (avatar.phone_country ?? "BR"))?.dial ??
        "+55";
      const phoneE164 = avatar.phone_number?.trim()
        ? formatE164(dial, avatar.phone_number)
        : null;
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: avatar.display_name.trim(),
          age: avatar.age ?? null,
          gender: avatar.gender ?? null,
          height_cm: avatar.height_cm ?? null,
          weight_kg: avatar.weight_kg ?? null,
          phone: phoneE164,
          phone_country: avatar.phone_country ?? "BR",
          goal: goal.goal,
          level: goal.level,
          time_per_day_min: goal.time_per_day_min,
          days_per_week: goal.days_per_week,
          behavioral_class: result.class,
          behavior_scores: result.scores,
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", userData.user.id);
      if (error) throw error;
      try {
        await seedHabitsForClass(userData.user.id, result.class);
      } catch {
        // hábitos sugeridos são best-effort; não bloqueia onboarding
      }
      toast.success("Bem-vindo ao mundo, " + avatar.display_name + ".");
      navigate({ to: "/home", replace: true });
    } catch (err) {
      // Surfaces PostgREST errors (which are plain objects, not Error instances)
      const anyErr = err as { message?: string; details?: string; hint?: string; code?: string } | null;
      const msg =
        (err instanceof Error && err.message) ||
        anyErr?.message ||
        anyErr?.details ||
        anyErr?.hint ||
        "Erro ao salvar.";
      console.error("[onboarding.finish] failed:", err);
      toast.error(msg + (anyErr?.code ? ` (${anyErr.code})` : ""));
    } finally {
      setSaving(false);
    }
  }

  if (step === 3) {
    return (
      <OnboardingShell
        step={4}
        total={4}
        title="O Oráculo"
        subtitle="Sua classe foi revelada."
        onBack={back}
      >
        <OracleReveal
          classId={result.class}
          scores={result.scores}
          onEnter={finish}
          loading={saving}
        />
      </OnboardingShell>
    );
  }

  const titles: Record<Exclude<Step, 3>, { title: string; subtitle: string }> = {
    0: {
      title: "Seu avatar",
      subtitle: "Quem é o herói da jornada?",
    },
    1: {
      title: "Seu objetivo",
      subtitle: "O que você quer conquistar?",
    },
    2: {
      title: "Diagnóstico",
      subtitle: "6 perguntas curtas. Sem certo ou errado.",
    },
  };

  const t = titles[step as Exclude<Step, 3>];

  return (
    <OnboardingShell
      step={step + 1}
      total={4}
      title={t.title}
      subtitle={t.subtitle}
      onBack={step === 0 ? undefined : back}
      footer={
        <button
          type="button"
          onClick={next}
          disabled={!canNext}
          className="ember-glow flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-display text-lg tracking-widest text-primary-foreground disabled:opacity-50 disabled:shadow-none"
        >
          {step === 2 ? "REVELAR CLASSE" : "CONTINUAR"}
          <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
        </button>
      }
    >
      {step === 0 && <AvatarStep value={avatar} onChange={setAvatar} />}
      {step === 1 && <GoalStep value={goal} onChange={setGoal} />}
      {step === 2 && <BehaviorStep value={answers} onChange={setAnswers} />}
    </OnboardingShell>
  );
}
