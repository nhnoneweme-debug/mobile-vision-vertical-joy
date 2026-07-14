import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createChatModelWithFallback } from "@/lib/ai-gateway.server";
import { checkRateLimit } from "@/lib/ai-guardrails.server";

export type FoodLogEntry = {
  id: string;
  log_date: string;
  logged_at: string;
  name: string;
  quantity_text: string | null;
  kcal: number;
  source: "photo" | "barcode" | "manual";
  barcode: string | null;
};

export type FoodProposal = {
  name: string;
  kcal: number;
  quantity_text: string;
  source: "photo" | "barcode" | "manual";
  barcode?: string;
};

const ProposalSchema = z.object({
  name: z.string().min(1).max(80),
  kcal: z.number().int().min(0).max(5000),
  quantity_text: z.string().max(120).optional(),
});

function parseProposalJson(raw: string): z.infer<typeof ProposalSchema> {
  const cleaned = raw.trim().replace(/^```json\s*|\s*```$/g, "");
  return ProposalSchema.parse(JSON.parse(cleaned));
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------------------------------------------------------------------------
// Foto — a IA analisa a imagem e estima o alimento + calorias (proposta, não
// grava nada ainda; o usuário confirma via confirmFoodLog).
// ---------------------------------------------------------------------------
export const logFoodFromPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        image_base64: z.string().min(100).max(3_000_000),
        media_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
        quantity_hint: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<FoodProposal> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!process.env.OPENAI_API_KEY && !LOVABLE_API_KEY) throw new Error("Missing AI key");

    const rl = checkRateLimit(context.userId);
    if (!rl.ok) throw new Error(rl.message);

    const model = createChatModelWithFallback(LOVABLE_API_KEY);
    const sys = [
      "Você é nutricionista assistente. Analise a foto de um alimento/prato e devolva APENAS JSON válido.",
      'Formato exato: { "name": "...", "kcal": 350, "quantity_text": "1 prato médio" }',
      "kcal é a estimativa TOTAL de calorias da porção mostrada na foto (ou da quantidade informada pelo usuário, se houver).",
      "Sem prosa, sem markdown, apenas o JSON.",
    ].join("\n");
    const userText = data.quantity_hint
      ? `Quantidade informada pelo usuário: ${data.quantity_hint}`
      : "Estime também a quantidade a partir da foto.";

    const res = await generateText({
      model,
      system: sys,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image", image: data.image_base64, mediaType: data.media_type },
          ],
        },
      ],
    });

    let parsed: z.infer<typeof ProposalSchema>;
    try {
      parsed = parseProposalJson(res.text);
    } catch {
      throw new Error(
        "Não consegui reconhecer o alimento na foto. Tente outra foto ou registre manualmente.",
      );
    }

    return {
      name: parsed.name,
      kcal: parsed.kcal,
      quantity_text: parsed.quantity_text ?? data.quantity_hint ?? "porção da foto",
      source: "photo",
    };
  });

// ---------------------------------------------------------------------------
// Código de barras — consulta a base pública OpenFoodFacts (sem IA, sem custo
// de crédito). Calcula kcal proporcional à quantidade informada (padrão 100g).
// ---------------------------------------------------------------------------
export const logFoodFromBarcode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        barcode: z
          .string()
          .min(6)
          .max(20)
          .regex(/^\d+$/, "Código de barras deve conter só números"),
        quantity_grams: z.number().min(1).max(5000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<FoodProposal> => {
    const grams = data.quantity_grams ?? 100;
    let res: Response;
    try {
      res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${data.barcode}.json`, {
        headers: { "User-Agent": "PersonalIA/1.0 (contato@personal-ia.app)" },
      });
    } catch {
      throw new Error("Não consegui consultar a base de produtos agora. Tente de novo.");
    }
    if (!res.ok) throw new Error("Não consegui consultar a base de produtos agora. Tente de novo.");

    const body = (await res.json()) as {
      status?: number;
      product?: {
        product_name?: string;
        nutriments?: Record<string, number>;
      };
    };

    if (body.status !== 1 || !body.product) {
      throw new Error(
        "Produto não encontrado para esse código de barras. Tente registrar manualmente.",
      );
    }

    const kcalPer100g = body.product.nutriments?.["energy-kcal_100g"];
    if (typeof kcalPer100g !== "number") {
      throw new Error(
        "Esse produto não tem informação de calorias cadastrada. Tente registrar manualmente.",
      );
    }

    const kcal = Math.round((kcalPer100g * grams) / 100);
    const name = body.product.product_name?.trim() || "Produto sem nome";

    return {
      name,
      kcal,
      quantity_text: `${grams}g`,
      source: "barcode",
      barcode: data.barcode,
    };
  });

// ---------------------------------------------------------------------------
// Manual — usuário descreve o que comeu em texto, a IA estima as calorias.
// ---------------------------------------------------------------------------
export const logFoodFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ description: z.string().min(3).max(300) }).parse(d))
  .handler(async ({ data, context }): Promise<FoodProposal> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!process.env.OPENAI_API_KEY && !LOVABLE_API_KEY) throw new Error("Missing AI key");

    const rl = checkRateLimit(context.userId);
    if (!rl.ok) throw new Error(rl.message);

    const model = createChatModelWithFallback(LOVABLE_API_KEY);
    const sys = [
      "Você é nutricionista assistente. Receba a descrição de um alimento/refeição e devolva APENAS JSON válido.",
      'Formato exato: { "name": "...", "kcal": 350, "quantity_text": "1 prato médio" }',
      "Sem prosa, sem markdown, apenas o JSON.",
    ].join("\n");

    const res = await generateText({
      model,
      system: sys,
      messages: [{ role: "user", content: data.description }],
    });

    let parsed: z.infer<typeof ProposalSchema>;
    try {
      parsed = parseProposalJson(res.text);
    } catch {
      throw new Error("Não consegui estimar as calorias. Tente descrever de outro jeito.");
    }

    return {
      name: parsed.name,
      kcal: parsed.kcal,
      quantity_text: parsed.quantity_text ?? data.description.slice(0, 60),
      source: "manual",
    };
  });

// ---------------------------------------------------------------------------
// Confirma e grava a proposta no diário (essa sim escreve no banco).
// ---------------------------------------------------------------------------
export const confirmFoodLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(80),
        kcal: z.number().int().min(0).max(20000),
        quantity_text: z.string().max(120).optional(),
        source: z.enum(["photo", "barcode", "manual"]),
        barcode: z.string().max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<FoodLogEntry> => {
    const { data: row, error } = await context.supabase
      .from("food_log_entries")
      .insert({
        user_id: context.userId,
        name: data.name,
        kcal: data.kcal,
        quantity_text: data.quantity_text ?? null,
        source: data.source,
        barcode: data.barcode ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as FoodLogEntry;
  });

export const deleteFoodLogEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("food_log_entries")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getTodayFoodLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ entries: FoodLogEntry[]; totalKcal: number }> => {
    const { data, error } = await context.supabase
      .from("food_log_entries")
      .select("*")
      .eq("user_id", context.userId)
      .eq("log_date", todayISO())
      .order("logged_at", { ascending: true });
    if (error) throw new Error(error.message);
    const entries = (data ?? []) as FoodLogEntry[];
    const totalKcal = entries.reduce((s, e) => s + e.kcal, 0);
    return { entries, totalKcal };
  });

// Histórico diário de kcal para o gráfico semanal/mensal.
export const getFoodLogHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(90) }).parse(d))
  .handler(async ({ data, context }): Promise<{ date: string; kcal: number }[]> => {
    const start = new Date();
    start.setDate(start.getDate() - (data.days - 1));
    const startISO = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;

    const { data: rows, error } = await context.supabase
      .from("food_log_entries")
      .select("log_date, kcal")
      .eq("user_id", context.userId)
      .gte("log_date", startISO)
      .order("log_date", { ascending: true });
    if (error) throw new Error(error.message);

    const byDate = new Map<string, number>();
    for (const r of (rows ?? []) as { log_date: string; kcal: number }[]) {
      byDate.set(r.log_date, (byDate.get(r.log_date) ?? 0) + r.kcal);
    }

    const out: { date: string; kcal: number }[] = [];
    for (let i = 0; i < data.days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      out.push({ date: iso, kcal: byDate.get(iso) ?? 0 });
    }
    return out;
  });
