// Memória compartilhada entre os frameworks Assistente / Planejar / Executar.
// Objetivo: um único ponto onde qualquer novo painel operacional lê o
// contexto vivo da pessoa (perfil, momento local, missões do dia) e injeta
// como "seed" na conversa com a WiMi. Mantém a IA coerente entre telas.

import { supabase } from "@/integrations/supabase/client";
import { getClientMoment, formatMomentLabel } from "@/lib/client-moment";

export type WimiFramework = "assistente" | "planejar" | "executar";

export type SharedContext = {
  framework: WimiFramework;
  momentLabel: string;
  displayName: string | null;
  aiName: string | null;
  todayCount: number;
};

// Snapshot leve — feito no client, sem hits pesados. Serve pra dar à IA
// (via primeira mensagem "seed") uma noção de quem está do outro lado e em
// qual palco a conversa está acontecendo.
export async function buildSharedContext(framework: WimiFramework): Promise<SharedContext> {
  const momentLabel = formatMomentLabel(getClientMoment());
  let displayName: string | null = null;
  let aiName: string | null = null;
  let todayCount = 0;

  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (uid) {
      const [{ data: profile }, { data: settings }, { count }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", uid).maybeSingle(),
        supabase.from("chat_settings").select("ai_name").eq("user_id", uid).maybeSingle(),
        supabase
          .from("user_missions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid)
          .eq("active", true)
          .is("archived_at", null),
      ]);
      displayName = (profile?.display_name as string | null) ?? null;
      aiName = (settings?.ai_name as string | null) ?? null;
      todayCount = count ?? 0;
    }
  } catch {
    /* silencioso — seed sem enriquecimento ainda é útil */
  }

  return { framework, momentLabel, displayName, aiName, todayCount };
}

// Frase de abertura injetada como primeira mensagem "do usuário" nos
// frameworks Planejar/Executar. Faz a WiMi assumir o papel correto sem
// exigir mudança no system prompt do /api/assistant.
export function seedForFramework(ctx: SharedContext): string {
  const who = ctx.displayName ? `Sou ${ctx.displayName}. ` : "";
  const when = `Agora é ${ctx.momentLabel}. `;
  if (ctx.framework === "planejar") {
    return (
      `${who}${when}Modo PLANEJAR: me ajude a estruturar um plano concreto pra o próximo bloco de tempo. ` +
      `Faça perguntas curtas primeiro, e quando tivermos o suficiente, proponha um bloco de execução ` +
      `em um code fence exatamente assim:\n\n\`\`\`plan\n{"blocks":[{"title":"...","area":"treino","start":"HH:MM","end":"HH:MM","notes":"..."}]}\n\`\`\`\n\n` +
      `Regras: até 5 blocos, HH:MM 24h, area em {treino,cozinha,mental,proposito,sono,vinculos,estudo,livre}. ` +
      `Fale em pt-BR, tom próximo, direto.`
    );
  }
  if (ctx.framework === "executar") {
    return `${who}${when}Modo EXECUTAR: estou no palco vivo de execução. Fala curto, direto, sem propor mudanças estruturais — só me acompanha aqui.`;
  }
  return `${who}${when}`;
}

// Extrai blocos do code fence ```plan {...}``` — retorna null se não achar
// nada válido. Tolerante a espaços e a texto ao redor.
export type ParsedPlanBlock = {
  title: string;
  area?: string | null;
  start?: string | null;
  end?: string | null;
  notes?: string | null;
};

export function extractPlanBlocks(text: string): ParsedPlanBlock[] | null {
  const match = text.match(/```plan\s*\n([\s\S]*?)```/i);
  if (!match) return null;
  try {
    const json = JSON.parse(match[1].trim()) as { blocks?: unknown };
    if (!Array.isArray(json.blocks)) return null;
    const out: ParsedPlanBlock[] = [];
    for (const raw of json.blocks) {
      if (!raw || typeof raw !== "object") continue;
      const b = raw as Record<string, unknown>;
      const title = typeof b.title === "string" ? b.title.trim() : "";
      if (!title) continue;
      out.push({
        title: title.slice(0, 140),
        area: typeof b.area === "string" ? b.area : null,
        start: typeof b.start === "string" ? b.start : null,
        end: typeof b.end === "string" ? b.end : null,
        notes: typeof b.notes === "string" ? b.notes.slice(0, 500) : null,
      });
      if (out.length >= 5) break;
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}
