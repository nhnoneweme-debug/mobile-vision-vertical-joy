import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Beta API: expose typed methods without depending on generated types.
type AuthorizationDetails = {
  client?: { name?: string | null; logo_uri?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};
type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{
    data: AuthorizationDetails | null;
    error: { message: string } | null;
  }>;
  approveAuthorization: (id: string) => Promise<{
    data: { redirect_url?: string | null; redirect_to?: string | null } | null;
    error: { message: string } | null;
  }>;
  denyAuthorization: (id: string) => Promise<{
    data: { redirect_url?: string | null; redirect_to?: string | null } | null;
    error: { message: string } | null;
  }>;
};
function oauth(): OAuthNs {
  return (supabase.auth as unknown as { oauth: OAuthNs }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id:
      typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) {
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get(
      "authorization_id",
    )!;
    const { data, error } = await oauth().getAuthorizationDetails(
      authorizationId,
    );
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[var(--shell-max)] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-display text-xl text-foreground">
        Não foi possível carregar esta autorização
      </h1>
      <p className="text-sm text-muted-foreground">
        {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "Este cliente";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const res = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (res.error) {
      setBusy(false);
      setError(res.error.message);
      return;
    }
    const target = res.data?.redirect_url ?? res.data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou uma URL de retorno.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main
      className="mx-auto flex min-h-[100dvh] w-full max-w-[var(--shell-max)] flex-col justify-center gap-5 bg-background px-6"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
    >
      <p className="font-display text-[10px] tracking-[0.4em] text-ember">
        WEME
      </p>
      <h1 className="font-display text-2xl leading-tight text-foreground">
        Conectar {clientName} à sua conta
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {clientName} vai poder usar o Weme em seu nome: consultar seu
        perfil, missões, hábitos e notificações, e gerar nudges do dia.
      </p>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide(true)}
          className="ember-glow rounded-2xl bg-primary px-6 py-3.5 font-display text-sm tracking-widest text-primary-foreground disabled:opacity-60"
        >
          APROVAR
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide(false)}
          className="rounded-2xl border border-border bg-card px-6 py-3.5 font-display text-sm tracking-widest text-muted-foreground disabled:opacity-60"
        >
          NEGAR
        </button>
      </div>
    </main>
  );
}
