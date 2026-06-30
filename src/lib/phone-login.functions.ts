import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Realiza login por telefone INTEIRAMENTE no servidor.
 * Aceita { phone, password }, resolve o email internamente e autentica.
 * O email NUNCA é retornado ao cliente — apenas a sessão em caso de sucesso.
 * Isso previne enumeração de usuários e coleta de PII.
 */
export const signInWithPhone = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        phone: z.string().min(5).max(20),
        password: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resposta genérica para falhas — não revela se o telefone existe
    const genericFailure = {
      ok: false as const,
      error: "Telefone ou senha inválidos.",
    };

    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", data.phone)
      .limit(1);
    if (error) return genericFailure;
    if (!rows || rows.length === 0) return genericFailure;

    const { data: userRes, error: uerr } =
      await supabaseAdmin.auth.admin.getUserById(rows[0].id as string);
    if (uerr || !userRes.user?.email) return genericFailure;

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { data: signIn, error: signErr } = await authClient.auth.signInWithPassword({
      email: userRes.user.email,
      password: data.password,
    });
    if (signErr || !signIn.session) return genericFailure;

    return {
      ok: true as const,
      session: {
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
      },
    };
  });
