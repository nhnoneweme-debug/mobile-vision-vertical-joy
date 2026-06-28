import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Sunrise, Moon, Sparkles, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import {
  getTodayRituals,
  saveRitual,
  type RitualLog,
} from "@/lib/ritual";
import { XPToast } from "@/components/map/XPToast";

export const Route = createFileRoute("/_authenticated/ritual")({
  head: () => ({
    meta: [
      { title: "Ritual diário — Personal IA" },
      { name: "description", content: "Abra e feche o dia com intenção." },
    ],
  }),
  component: RitualPage,
});

type Tab = "morning" | "night";

function RitualPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() =>
    new Date().getHours() < 17 ? "morning" : "night",
  );
  const [morning, setMorning] = useState<RitualLog | null>(null);
  const [night, setNight] = useState<RitualLog | null>(null);
  const [intention, setIntention] = useState("");
  const [r1, setR1] = useState("");
  const [r2, setR2] = useState("");
  const [r3, setR3] = useState("");
  const [saving, setSaving] = useState(false);
  const [xpToast, setXpToast] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      const rituals = await getTodayRituals(data.user.id);
      setMorning(rituals.morning);
      setNight(rituals.night);
    })();
  }, []);

  const done = tab === "morning" ? morning : night;

  const headerMeta = useMemo(
    () =>
      tab === "morning"
        ? {
            label: "RITUAL DA MANHÃ",
            title: "Abra o dia",
            sub: "Defina uma intenção. Pequena. Concreta.",
            icon: Sunrise,
          }
        : {
            label: "RITUAL DA NOITE",
            title: "Feche o dia",
            sub: "Três respostas curtas. Honestas.",
            icon: Moon,
          },
    [tab],
  );

  async function handleSave() {
    if (!userId || saving) return;
    setSaving(true);
    try {
      if (tab === "morning") {
        const text = intention.trim();
        if (!text) {
          toast.error("Escreva sua intenção.");
          setSaving(false);
          return;
        }
        const r = await saveRitual(userId, "morning", { intention: text });
        setMorning(r);
        setIntention("");
      } else {
        const reflections = {
          gratidao: r1.trim(),
          aprendizado: r2.trim(),
          amanha: r3.trim(),
        };
        if (!reflections.gratidao && !reflections.aprendizado && !reflections.amanha) {
          toast.error("Responda pelo menos uma reflexão.");
          setSaving(false);
          return;
        }
        const r = await saveRitual(userId, "night", { reflections });
        setNight(r);
        setR1("");
        setR2("");
        setR3("");
      }
      setXpToast(25);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const Icon = headerMeta.icon;

  return (
    <MobileShell>
      <header
        className="border-b border-border px-4 pb-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <Link
          to="/mapa"
          className="mb-3 inline-flex items-center gap-1 font-display text-[10px] tracking-[0.3em] text-muted-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> MAPA
        </Link>
        <p className="font-display text-[10px] tracking-[0.4em] text-ember">
          {headerMeta.label}
        </p>
        <h1 className="mt-1 flex items-center gap-3 font-display text-3xl tracking-wide text-foreground">
          <Icon className="h-7 w-7 text-ember" strokeWidth={2} />
          {headerMeta.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{headerMeta.sub}</p>
      </header>

      <div className="grid grid-cols-2 gap-2 px-4 pt-4">
        <TabButton
          active={tab === "morning"}
          done={!!morning}
          onClick={() => setTab("morning")}
          icon={<Sunrise className="h-4 w-4" />}
          label="MANHÃ"
        />
        <TabButton
          active={tab === "night"}
          done={!!night}
          onClick={() => setTab("night")}
          icon={<Moon className="h-4 w-4" />}
          label="NOITE"
        />
      </div>

      <section className="px-4 py-5 pb-32">
        {done ? (
          <CompletedCard log={done} />
        ) : tab === "morning" ? (
          <div className="space-y-4">
            <Field label="MINHA INTENÇÃO PARA HOJE">
              <textarea
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                placeholder="Hoje eu vou…"
                rows={4}
                className="w-full resize-none rounded-xl border border-border bg-charcoal-900 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-ember focus:outline-none"
              />
            </Field>
            <SaveButton onClick={handleSave} saving={saving} />
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="UMA GRATIDÃO DE HOJE">
              <textarea
                value={r1}
                onChange={(e) => setR1(e.target.value)}
                rows={2}
                placeholder="Algo simples que valeu…"
                className="w-full resize-none rounded-xl border border-border bg-charcoal-900 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-ember focus:outline-none"
              />
            </Field>
            <Field label="UM APRENDIZADO">
              <textarea
                value={r2}
                onChange={(e) => setR2(e.target.value)}
                rows={2}
                placeholder="O que o dia te ensinou…"
                className="w-full resize-none rounded-xl border border-border bg-charcoal-900 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-ember focus:outline-none"
              />
            </Field>
            <Field label="UM PASSO PARA AMANHÃ">
              <textarea
                value={r3}
                onChange={(e) => setR3(e.target.value)}
                rows={2}
                placeholder="Pequeno, executável…"
                className="w-full resize-none rounded-xl border border-border bg-charcoal-900 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-ember focus:outline-none"
              />
            </Field>
            <SaveButton onClick={handleSave} saving={saving} />
          </div>
        )}
      </section>

      {xpToast !== null && (
        <XPToast amount={xpToast} leveledUp={false} onDone={() => setXpToast(null)} />
      )}
    </MobileShell>
  );
}

function TabButton({
  active,
  done,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  done: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-display text-xs tracking-[0.3em] transition-colors ${
        active
          ? "border-ember bg-ember/10 text-ember"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      {icon}
      {label}
      {done && <Check className="h-3.5 w-3.5 text-ember" />}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-display text-[10px] tracking-[0.3em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function SaveButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="ember-glow flex w-full items-center justify-center gap-2 rounded-2xl bg-ember px-6 py-4 font-display tracking-widest text-charcoal-900 disabled:opacity-50 active:scale-[0.99]"
    >
      <Sparkles className="h-4 w-4" strokeWidth={2.4} />
      {saving ? "SALVANDO…" : "SELAR RITUAL · +25 XP"}
    </button>
  );
}

function CompletedCard({ log }: { log: RitualLog }) {
  const entries = log.intention
    ? [{ label: "INTENÇÃO", text: log.intention }]
    : Object.entries(log.reflections)
        .filter(([, v]) => v && v.trim())
        .map(([k, v]) => ({
          label:
            k === "gratidao"
              ? "GRATIDÃO"
              : k === "aprendizado"
                ? "APRENDIZADO"
                : "AMANHÃ",
          text: v,
        }));

  return (
    <div className="rounded-2xl border border-ember/40 bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Check className="h-4 w-4 text-ember" strokeWidth={2.4} />
        <p className="font-display text-[10px] tracking-[0.3em] text-ember">
          RITUAL SELADO HOJE
        </p>
      </div>
      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.label}>
            <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
              {e.label}
            </p>
            <p className="mt-1 text-sm text-foreground">{e.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
