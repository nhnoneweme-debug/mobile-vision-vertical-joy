// Nível de raciocínio compartilhado entre o cliente e as rotas de IA.
// low/medium/high mapeiam para `reasoningEffort` do provider OpenAI-compatível.
export type Effort = "low" | "medium" | "high";

export const EFFORT_STORAGE_KEY = "wimi:chat-effort";

export function validateEffort(v: unknown): Effort {
  return v === "low" || v === "medium" || v === "high" ? v : "medium";
}

export function loadEffort(): Effort {
  if (typeof window === "undefined") return "medium";
  try {
    return validateEffort(window.localStorage.getItem(EFFORT_STORAGE_KEY));
  } catch {
    return "medium";
  }
}

export function saveEffort(v: Effort) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EFFORT_STORAGE_KEY, v);
  } catch {
    /* noop */
  }
}

// Provider é openai-compatible ("openai" direto ou "lovable" gateway).
// Enviar em ambos garante que o parâmetro chegue no backend correto.
export function effortProviderOptions(effort: Effort) {
  return {
    openai: { reasoningEffort: effort },
    lovable: { reasoningEffort: effort },
  } as const;
}
