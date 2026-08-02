import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { wrapLanguageModel } from "ai";

// Provedor da inteligência do app. Preferimos a **API da OpenAI direto** quando
// `OPENAI_API_KEY` está definido; caso contrário, usamos o Lovable AI Gateway.
// Segurança: a chave é lida SEMPRE do ambiente do servidor. Nunca fica no código,
// no bundle do cliente nem no repositório.
const HAS_OPENAI = !!process.env.OPENAI_API_KEY;

/**
 * Modelo principal. Default depende do provedor:
 *  - OpenAI direto: `gpt-4o` (ajuste via env `AI_CHAT_MODEL`, ex.: `gpt-4.1`, `o4-mini`).
 *  - Lovable Gateway: `openai/gpt-5.6-sol`.
 */
export const AI_CHAT_MODEL =
  process.env.AI_CHAT_MODEL ?? (HAS_OPENAI ? "gpt-4o" : "openai/gpt-5.6-sol");

/** Modelo de reserva (usado em 402 sem saldo / 429 rate limit). Mais barato/rápido. */
export const AI_FALLBACK_MODEL =
  process.env.AI_FALLBACK_MODEL ?? (HAS_OPENAI ? "gpt-4o-mini" : "openai/gpt-5-mini");

// Modelos da família gpt-5.x/o-series (inclusive via Lovable AI Gateway) rejeitam o
// parâmetro legado `max_tokens` ("Unsupported parameter... Use 'max_completion_tokens'
// instead"). O @ai-sdk/openai-compatible sempre manda `max_tokens`, então remapeamos
// aqui antes do envio.
//
// Além disso, a família gpt-5.6 em /v1/chat/completions REJEITA (400) qualquer
// `reasoning_effort` diferente de "none" quando há tools na requisição — então
// normalizamos o campo aqui, no único ponto por onde todas as chamadas passam.
function normalizeRequest(args: Record<string, unknown>): Record<string, unknown> {
  let out = args;
  if (out && "max_tokens" in out) {
    const { max_tokens, ...rest } = out;
    out = max_tokens == null ? rest : { ...rest, max_completion_tokens: max_tokens };
  }
  const model = String((out as { model?: unknown }).model ?? "");
  if (/gpt-5\.6/.test(model)) {
    const hasTools = Array.isArray((out as { tools?: unknown }).tools);
    if (hasTools || (out as { reasoning_effort?: unknown }).reasoning_effort == null) {
      out = { ...out, reasoning_effort: "none" };
    }
  }
  return out;
}

const remapMaxTokens = normalizeRequest;


export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    transformRequestBody: remapMaxTokens,
  });
}

export function createOpenAIDirectProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    apiKey,
    transformRequestBody: remapMaxTokens,
  });
}

/** Escolhe OpenAI direto (se OPENAI_API_KEY) ou o Lovable Gateway. */
function chooseProvider(lovableApiKey?: string) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) return createOpenAIDirectProvider(openaiKey);
  const lovable = lovableApiKey ?? process.env.LOVABLE_API_KEY;
  if (!lovable) {
    throw new Error(
      "Nenhuma chave de IA configurada. Defina OPENAI_API_KEY (recomendado) ou LOVABLE_API_KEY no ambiente do servidor.",
    );
  }
  return createLovableAiGatewayProvider(lovable);
}

/** Detecta erro de saldo (402) ou rate limit (429) para acionar o fallback. */
function isCapacityError(err: unknown): boolean {
  const e = err as { statusCode?: number; status?: number; response?: { status?: number }; message?: string };
  const status = e?.statusCode ?? e?.status ?? e?.response?.status;
  if (status === 402 || status === 429) return true;
  const msg = String(e?.message ?? "");
  return /(\b402\b|\b429\b|rate.?limit|too many requests|payment required|insufficient|quota)/i.test(msg);
}

/**
 * Modelo de chat com **fallback automático**: se o principal (`AI_CHAT_MODEL`)
 * responder 402 (sem saldo) ou 429 (rate limit), a mesma requisição é reexecutada
 * no `AI_FALLBACK_MODEL`. Vale para `streamText` e `generateText` (fallback no
 * nível do LanguageModel). O argumento `lovableApiKey` é opcional e só é usado
 * quando NÃO há `OPENAI_API_KEY`.
 */
export function createChatModelWithFallback(lovableApiKey?: string) {
  const provider = chooseProvider(lovableApiKey);
  const primary = provider(AI_CHAT_MODEL);
  const fallback = provider(AI_FALLBACK_MODEL);

  return wrapLanguageModel({
    model: primary,
    middleware: {
      wrapGenerate: async ({ doGenerate, params }) => {
        try {
          return await doGenerate();
        } catch (err) {
          if (!isCapacityError(err)) throw err;
          return await fallback.doGenerate(params);
        }
      },
      wrapStream: async ({ doStream, params }) => {
        try {
          return await doStream();
        } catch (err) {
          if (!isCapacityError(err)) throw err;
          return await fallback.doStream(params);
        }
      },
    },
  });
}
