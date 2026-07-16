import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SITE_URL = "https://mobile-vision-vertical-joy.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Weme — Sua jornada de bem-estar" },
      {
        name: "description",
        content:
          "Weme transforma cuidar de si em uma jornada viva: treino, sono, mente e rotina guiados por IA.",
      },
      { property: "og:title", content: "Weme — Sua jornada de bem-estar" },
      {
        property: "og:description",
        content: "Sua jornada gamificada de bem-estar guiada por IA.",
      },
      { property: "og:url", content: `${SITE_URL}/` },
      { name: "twitter:title", content: "Weme — Sua jornada de bem-estar" },
      {
        name: "twitter:description",
        content: "Sua jornada gamificada de bem-estar guiada por IA.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Weme",
          url: SITE_URL,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Weme",
          url: SITE_URL,
        }),
      },
    ],
  }),
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/home" });
    }
  },
  component: Splash,
});

function Splash() {
  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[var(--shell-max)] flex-col justify-between overflow-hidden bg-background px-6 pb-10 pt-16">
      {/* Ambient ember glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--ember) 35%, transparent), transparent)",
        }}
      />

      <header className="relative z-10 flex flex-col items-center text-center">
        <div className="ember-pulse grid h-16 w-16 place-items-center rounded-2xl bg-charcoal-800">
          <Sparkles className="h-7 w-7 text-ember" strokeWidth={2.2} />
        </div>
        <p className="mt-6 font-display text-[11px] tracking-[0.4em] text-ember">
          WEME
        </p>
        <h1 className="mt-2 font-display text-5xl leading-[0.95] tracking-wide text-foreground">
          Cuide de si <br /> como uma <br />
          <span className="text-ember">jornada viva.</span>
        </h1>
        <p className="mt-5 max-w-xs text-base text-muted-foreground">
          Treino, sono, mente e rotina em um mundo guiado por IA. Você não está
          mais sozinho na consistência.
        </p>
      </header>

      <footer className="relative z-10 flex flex-col gap-3">
        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="ember-glow flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-display text-lg tracking-widest text-primary-foreground active:scale-[0.99]"
        >
          INICIAR JORNADA
          <ArrowRight className="h-5 w-5" strokeWidth={2.6} />
        </Link>
        <Link
          to="/auth"
          search={{ mode: "login" }}
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 py-4 font-display text-base tracking-widest text-foreground active:scale-[0.99]"
        >
          JÁ ESTOU NA JORNADA
        </Link>
        <p className="mt-1 text-center font-display text-[10px] tracking-[0.3em] text-muted-foreground">
          ENTRE POR EMAIL, TELEFONE OU GOOGLE
        </p>
      </footer>
    </div>
  );
}
