import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Personal IA" },
      { name: "description", content: "Entre ou crie sua conta no Personal IA." },
    ],
  }),
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/mapa" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Avatar criado. Hora do diagnóstico.");
        navigate({ to: "/onboarding", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
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
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-background px-6 pb-10">
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

        <div className="mt-6 flex gap-2 rounded-xl border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-lg px-3 py-2 font-display text-sm tracking-[0.2em] ${
              mode === "signup"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            CRIAR
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-lg px-3 py-2 font-display text-sm tracking-[0.2em] ${
              mode === "login"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            ENTRAR
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <Field
              label="Nome do avatar"
              type="text"
              value={displayName}
              onChange={setDisplayName}
              placeholder="ex: Luna"
              autoComplete="nickname"
            />
          )}
          <Field
            label="E-mail"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="voce@exemplo.com"
            autoComplete="email"
            required
          />
          <Field
            label="Senha"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="mínimo 6 caracteres"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="ember-glow flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-display text-lg tracking-widest text-primary-foreground disabled:opacity-60"
          >
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            {mode === "signup" ? "CRIAR AVATAR" : "ENTRAR"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
        {label.toUpperCase()}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="mt-1 w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-ember focus:outline-none"
      />
    </label>
  );
}
