import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Flame, Crown, Coins, X } from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";
import { BottomNav } from "@/components/shell/BottomNav";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({
    meta: [
      { title: "Planos Brasas+ — Personal IA" },
      {
        name: "description",
        content:
          "Assine Brasas+ ou compre pacotes avulsos de Brasas para acelerar sua jornada.",
      },
    ],
  }),
  component: PlanosPage,
});

type Cycle = "monthly" | "yearly";

const PLANS = [
  {
    id: "essencial",
    name: "Essencial",
    icon: Sparkles,
    monthly: { priceId: "brasas_plus_essencial_monthly", amount: "R$ 19,90" },
    yearly: { priceId: "brasas_plus_essencial_yearly", amount: "R$ 179", note: "≈ R$ 14,92/mês" },
    perks: [
      "IA diária e missões",
      "Rituais de manhã e noite",
      "Saga e progresso pessoal",
    ],
  },
  {
    id: "jornada",
    name: "Jornada",
    icon: Flame,
    highlight: true,
    monthly: { priceId: "brasas_plus_jornada_monthly", amount: "R$ 34,90" },
    yearly: { priceId: "brasas_plus_jornada_yearly", amount: "R$ 319", note: "≈ R$ 26,58/mês" },
    perks: [
      "Tudo do Essencial",
      "IA-Coletora em modo automático",
      "Cristais avançados, temas premium e Studio",
    ],
  },
  {
    id: "lendario",
    name: "Lendário",
    icon: Crown,
    monthly: { priceId: "brasas_plus_lendario_monthly", amount: "R$ 59,90" },
    yearly: { priceId: "brasas_plus_lendario_yearly", amount: "R$ 549", note: "≈ R$ 45,75/mês" },
    perks: [
      "Tudo do Jornada",
      "Orientador prioritário e grupos privados",
      "Alarme avançado e suporte direto",
    ],
  },
] as const;

const PACKS = [
  { id: "pack500", priceId: "brasas_pack_500_once", brasas: "500", price: "R$ 9,90", bonus: null },
  {
    id: "pack1500",
    priceId: "brasas_pack_1500_once",
    brasas: "1.500",
    price: "R$ 24,90",
    bonus: "+200 bônus",
  },
  {
    id: "pack5000",
    priceId: "brasas_pack_5000_once",
    brasas: "5.000",
    price: "R$ 69,90",
    bonus: "+1.000 bônus",
  },
] as const;

function PlanosPage() {
  const [cycle, setCycle] = useState<Cycle>("yearly");
  const [tab, setTab] = useState<"assinatura" | "brasas">("assinatura");
  const [checkout, setCheckout] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | undefined>();
  const [email, setEmail] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
      setEmail(data.user?.email ?? undefined);
    });
  }, []);

  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`
      : undefined;

  return (
    <MobileShell>
      <PaymentTestModeBanner />
      <header
        className="sticky top-0 z-30 border-b border-border bg-charcoal-900/90 px-4 pb-4 pt-5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <p className="font-display text-[10px] tracking-[0.3em] text-ember">PLANOS</p>
        <h1 className="font-display text-2xl tracking-wide text-foreground">
          Acenda sua chama
        </h1>
        <nav className="mt-4 flex gap-1 rounded-xl bg-charcoal-800 p-1">
          <button
            onClick={() => setTab("assinatura")}
            className={`flex-1 rounded-lg px-3 py-2 font-display text-[11px] tracking-[0.18em] ${
              tab === "assinatura" ? "bg-ember text-charcoal-900" : "text-muted-foreground"
            }`}
          >
            BRASAS+
          </button>
          <button
            onClick={() => setTab("brasas")}
            className={`flex-1 rounded-lg px-3 py-2 font-display text-[11px] tracking-[0.18em] ${
              tab === "brasas" ? "bg-ember text-charcoal-900" : "text-muted-foreground"
            }`}
          >
            PACOTES
          </button>
        </nav>
      </header>

      <div className="space-y-4 px-4 pb-32 pt-4">
        {tab === "assinatura" ? (
          <>
            <div className="flex justify-center gap-1 rounded-xl border border-border bg-charcoal-800 p-1">
              <button
                onClick={() => setCycle("monthly")}
                className={`flex-1 rounded-lg px-3 py-1.5 font-display text-[11px] tracking-[0.18em] ${
                  cycle === "monthly" ? "bg-foreground text-charcoal-900" : "text-muted-foreground"
                }`}
              >
                MENSAL
              </button>
              <button
                onClick={() => setCycle("yearly")}
                className={`flex-1 rounded-lg px-3 py-1.5 font-display text-[11px] tracking-[0.18em] ${
                  cycle === "yearly" ? "bg-foreground text-charcoal-900" : "text-muted-foreground"
                }`}
              >
                ANUAL · -25%
              </button>
            </div>

            {PLANS.map((p) => {
              const opt = p[cycle];
              const Icon = p.icon;
              return (
                <article
                  key={p.id}
                  className={`rounded-2xl border p-4 ${
                    p.highlight
                      ? "border-ember/60 bg-ember/5 shadow-[0_0_24px_-12px_var(--ember)]"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-charcoal-800 text-ember">
                      <Icon className="h-5 w-5" strokeWidth={2.2} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display text-lg tracking-wide text-foreground">
                        Brasas+ {p.name}
                      </h3>
                      {p.highlight && (
                        <span className="font-display text-[9px] tracking-[0.22em] text-ember">
                          MAIS ESCOLHIDO
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-display text-3xl text-foreground">{opt.amount}</span>
                    <span className="font-sans text-xs text-muted-foreground">
                      /{cycle === "monthly" ? "mês" : "ano"}
                    </span>
                  </div>
                  {"note" in opt && opt.note && (
                    <p className="font-display text-[10px] tracking-[0.18em] text-muted-foreground">
                      {opt.note}
                    </p>
                  )}
                  <ul className="mt-3 space-y-1.5">
                    {p.perks.map((perk) => (
                      <li key={perk} className="flex gap-2 font-sans text-sm text-muted-foreground">
                        <span className="text-ember">•</span> {perk}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setCheckout(opt.priceId)}
                    className="mt-4 w-full rounded-xl bg-ember py-3 font-display text-sm tracking-[0.18em] text-charcoal-900"
                  >
                    ASSINAR {p.name.toUpperCase()}
                  </button>
                </article>
              );
            })}
          </>
        ) : (
          <>
            <p className="font-sans text-xs text-muted-foreground">
              Brasas avulsas para forjar itens, perks e cosméticos.
            </p>
            {PACKS.map((p) => (
              <article
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-charcoal-800 text-ember">
                  <Coins className="h-5 w-5" strokeWidth={2.4} />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg tracking-wide text-foreground">
                    {p.brasas} Brasas
                  </h3>
                  {p.bonus && (
                    <span className="font-display text-[10px] tracking-[0.18em] text-ember">
                      {p.bonus}
                    </span>
                  )}
                  <p className="mt-0.5 font-display text-base text-foreground">{p.price}</p>
                </div>
                <button
                  onClick={() => setCheckout(p.priceId)}
                  className="rounded-lg bg-ember px-4 py-2.5 font-display text-[11px] tracking-[0.18em] text-charcoal-900"
                >
                  COMPRAR
                </button>
              </article>
            ))}
          </>
        )}
      </div>

      {checkout && (
        <div className="fixed inset-0 z-50 flex flex-col bg-charcoal-900">
          <div
            className="flex items-center justify-between border-b border-border px-4 py-3"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
          >
            <span className="font-display text-sm tracking-[0.18em] text-foreground">
              CHECKOUT SEGURO
            </span>
            <button
              onClick={() => setCheckout(null)}
              className="rounded-full border border-border bg-charcoal-800 p-2 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <StripeEmbeddedCheckout
              priceId={checkout}
              userId={userId}
              customerEmail={email}
              returnUrl={returnUrl}
            />
          </div>
        </div>
      )}

      <BottomNav />
    </MobileShell>
  );
}
