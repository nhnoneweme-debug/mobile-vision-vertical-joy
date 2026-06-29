import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Resolve um telefone (E.164) para o email cadastrado no `auth.users`.
 * Usa o cliente admin somente para esta consulta read-only mínima.
 */
export const lookupEmailByPhone = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ phone: z.string().min(5).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id, phone")
      .eq("phone", data.phone)
      .limit(1);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return { email: null as string | null };
    const userId = rows[0].id as string;
    const { data: userRes, error: uerr } =
      await supabaseAdmin.auth.admin.getUserById(userId);
    if (uerr) throw new Error(uerr.message);
    return { email: userRes.user?.email ?? null };
  });
