import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PhoneInput } from "@/components/auth/PhoneInput";
import { COUNTRIES, DEFAULT_COUNTRY, formatE164, type Country } from "@/lib/countries";
import { signInWithPhone } from "@/lib/phone-login.functions";

type AuthSearch = { mode?: "login" | "signup"; next?: string };

function safeNext(next: string | undefined): string | undefined {
  if (!next) return undefined;
  // Only allow same-origin relative paths.
  if (!next.startsWith("/") || next.startsWith("//")) return undefined;
  return next;
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Personal IA" },
      { name: "description", content: "Entre ou crie sua conta no Personal IA por email, telefone ou SSO." },
      { property: "og:title", content: "Entrar — Personal IA" },
      { property: "og:description", content: "Entre ou crie sua conta no Personal IA por email, telefone ou SSO." },
      { property: "og:url", content: "https://mobile-vision-vertical-joy.lovable.app/auth" },
      { name: "twitter:title", content: "Entrar — Personal IA" },
      { name: "twitter:description", content: "Entre ou crie sua conta no Personal IA por email, telefone ou SSO." },
    ],
    links: [{ rel: "canonical", href: "https://mobile-vision-vertical-joy.lovable.app/auth" }],
  }),
  ssr: false,
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    mode: search.mode === "login" || search.mode === "signup" ? search.mode : undefined,
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const next = safeNext(search.next);
      throw redirect(next ? { href: next } : { to: "/mapa" });
    }
  },
  component: AuthPage,
});

type Mode = "login" | "signup";
type Method = "email" | "phone";

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>(search.mode ?? "signup");
  const [method, setMethod] = useState<Method>("email");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error instanceof Error ? result.error : new Error(String(result.error));
      if (result.redirected) return; // browser navigated away
      // Sessão setada — vamos para onboarding (a rota redireciona se já completo)
      navigate({ to: "/onboarding", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no login Google.";
      toast.error(msg);
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (mode === "signup") {
      if (password.length < 6) {
        toast.error("A senha precisa ter ao menos 6 caracteres.");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("As senhas não coincidem.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        // Signup sempre via email (telefone fica como contato no profile).
        if (method === "phone" && !email) {
          toast.error("Informe um e-mail para receber confirmações.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        // Se telefone foi informado no signup, persiste no profile imediatamente
        if (data.user && phoneNumber.trim()) {
          const phoneE164 = formatE164(country.dial, phoneNumber);
          await supabase
            .from("profiles")
            .update({ phone: phoneE164, phone_country: country.code })
            .eq("id", data.user.id);
        }
        toast.success("Avatar criado. Hora do diagnóstico.");
        navigate({ to: "/onboarding", replace: true });
      } else {
        // LOGIN
        if (method === "phone") {
          const phoneE164 = formatE164(country.dial, phoneNumber);
          if (!phoneE164) {
            toast.error("Informe o número de telefone.");
            return;
          }
          const res = await signInWithPhone({
            data: { phone: phoneE164, password },
          });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          const { error: setErr } = await supabase.auth.setSession(res.session);
          if (setErr) throw setErr;
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
        }
        toast.success("De volta à jornada.");
        navigate({ to: "/mapa", replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Algo deu errado.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[var(--shell-max)] flex-col bg-background px-6 pb-10">
      <header
        className="flex items-center gap-3 pb-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <Link
          to="/"
          className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
        </Link>
        <p className="font-display text-[10px] tracking-[0.4em] text-ember">
          PERSONAL IA
        </p>
      </header>

      <div className="flex-1">
        <h1 className="font-display text-4xl leading-none tracking-wide text-foreground">
          {mode === "signup" ? "Crie seu avatar" : "Bem-vindo de volta"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signup"
            ? "Comece sua jornada gamificada de bem-estar."
            : "Entre para continuar a jornada."}
        </p>

        {/* Toggle Login/Signup */}
        <div className="mt-6 flex gap-2 rounded-xl border border-border bg-card p-1">
          <ToggleBtn active={mode === "signup"} onClick={() => setMode("signup")}>
            CRIAR
          </ToggleBtn>
          <ToggleBtn active={mode === "login"} onClick={() => setMode("login")}>
            ENTRAR
          </ToggleBtn>
        </div>

        {/* Google SSO */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 py-3.5 font-display text-sm tracking-widest text-foreground disabled:opacity-60"
        >
          {googleLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          CONTINUAR COM GOOGLE
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
            OU
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Método: email / telefone */}
        <div className="flex gap-2 rounded-xl border border-border bg-card p-1">
          <MethodBtn active={method === "email"} onClick={() => setMethod("email")}>
            <Mail className="h-4 w-4" /> E-MAIL
          </MethodBtn>
          <MethodBtn active={method === "phone"} onClick={() => setMethod("phone")}>
            <Phone className="h-4 w-4" /> TELEFONE
          </MethodBtn>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {mode === "signup" && (
            <Field label="Nome do avatar">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ex: Luna"
                autoComplete="nickname"
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-ember focus:outline-none"
              />
            </Field>
          )}

          {/* Sempre pedir email no signup (telefone é complemento) */}
          {(method === "email" || mode === "signup") && (
            <Field label="E-mail">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-ember focus:outline-none"
              />
            </Field>
          )}

          {(method === "phone" || mode === "signup") && (
            <Field label={mode === "signup" ? "Telefone (opcional)" : "Telefone"}>
              <PhoneInput
                country={country}
                onCountryChange={setCountry}
                number={phoneNumber}
                onNumberChange={setPhoneNumber}
                required={method === "phone" && mode === "login"}
              />
            </Field>
          )}

          <Field label="Senha">
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="mínimo 6 caracteres"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
            />
          </Field>

          {mode === "signup" && (
            <Field label="Confirmar senha">
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="digite novamente"
                autoComplete="new-password"
                required
              />
            </Field>
          )}

          <button
            type="submit"
            disabled={loading}
            className="ember-glow flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-display text-lg tracking-widest text-primary-foreground disabled:opacity-60"
          >
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            {mode === "signup" ? "CRIAR AVATAR" : "ENTRAR"}
          </button>

          {mode === "login" && method === "phone" && (
            <p className="text-center text-[11px] text-muted-foreground">
              Login por telefone usa o telefone cadastrado no seu perfil.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 font-display text-sm tracking-[0.2em] ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function MethodBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 font-display text-[12px] tracking-[0.2em] ${
        active ? "bg-charcoal-800 text-foreground" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
        {label.toUpperCase()}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.5 6.7 2.5 12s4.2 9.6 9.5 9.6c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}
