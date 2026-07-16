import { supabase } from "@/integrations/supabase/client";

/**
 * Header de auth resolvido NA HORA do request.
 *
 * O transport do useChat é construído uma vez, no primeiro render — se as
 * headers vierem de um state que só é preenchido depois (getSession é async),
 * o transport congela `Authorization: undefined` e a API responde 401 pra
 * sempre. Passar esta função (Resolvable) faz o SDK resolver a cada envio,
 * o que também pega o token novo depois de um refresh de sessão.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
