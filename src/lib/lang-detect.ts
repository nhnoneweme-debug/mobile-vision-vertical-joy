// DETECÇÃO DE IDIOMA (heurística local, sem chamada de modelo).
//
// Serve para dois usos distintos:
//  • ESCUTA — o reconhecedor nativo do navegador exige um idioma fixo e NÃO faz
//    auto-detecção. Analisamos o texto que sai transcrito e, se ele sair
//    consistentemente em outro idioma suportado, trocamos o reconhecedor.
//    Limitação aceita: ~1 frase de atraso na virada.
//  • FALA — quando o modelo devolve `reply_lang`, usamos direto; a heurística
//    é só o fallback.

export type ReplyLang = "pt-BR" | "en-US" | "es-ES";

export const SUPPORTED_LANGS: { code: ReplyLang; label: string; name: string }[] = [
  { code: "pt-BR", label: "PT", name: "português" },
  { code: "en-US", label: "EN", name: "inglês" },
  { code: "es-ES", label: "ES", name: "espanhol" },
];

export function langName(code: string): string {
  return SUPPORTED_LANGS.find((l) => l.code === code)?.name ?? code;
}

/** Normaliza qualquer rótulo de idioma para um dos três suportados. */
export function normalizeReplyLang(value: unknown, fallback: ReplyLang = "pt-BR"): ReplyLang {
  if (typeof value !== "string") return fallback;
  const base = value.slice(0, 2).toLowerCase();
  if (base === "en") return "en-US";
  if (base === "es") return "es-ES";
  if (base === "pt") return "pt-BR";
  return fallback;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const MARKERS: Record<ReplyLang, string[]> = {
  "pt-BR": [
    "que","nao","uma","com","para","voce","isso","mas","tambem","entao","agora","aqui","muito",
    "estou","esta","vamos","fazer","dia","hoje","porque","tudo","bem","preciso","quero","ser",
    "sim","obrigado","como","quando","depois","ainda","ja","gente","coisa","sobre","meu","minha",
  ],
  "en-US": [
    "the","and","you","that","for","with","this","have","what","just","about","would","really",
    "going","need","want","today","now","because","think","know","let","can","should","from",
    "there","here","yes","thanks","how","when","after","still","thing","my","our","doing",
  ],
  "es-ES": [
    "que","los","las","una","con","para","pero","tambien","entonces","ahora","aqui","muy","estoy",
    "vamos","hacer","dia","hoy","porque","todo","bien","necesito","quiero","ser","si","gracias",
    "como","cuando","despues","todavia","ya","cosa","sobre","mi","nuestro","hacia","del","este",
  ],
};

// Palavras que existem em mais de um idioma perdem peso.
const AMBIGUOUS = new Set(["que", "como", "sobre", "no", "a", "e", "o", "si", "my", "mi", "para", "con"]);

/**
 * Detecta o idioma do texto. Devolve `null` quando não há evidência suficiente
 * (texto curto demais ou empate) — nesse caso NÃO se troca nada.
 */
export function detectLang(text: string): ReplyLang | null {
  const ws = words(text);
  if (ws.length < 4) return null;
  const scores: Record<ReplyLang, number> = { "pt-BR": 0, "en-US": 0, "es-ES": 0 };
  for (const w of ws) {
    const weight = AMBIGUOUS.has(w) ? 0.3 : 1;
    for (const lang of Object.keys(scores) as ReplyLang[]) {
      if (MARKERS[lang].includes(w)) scores[lang] += weight;
    }
  }
  // Sinais ortográficos fortes.
  if (/[ãõçâê]/i.test(text)) scores["pt-BR"] += 2.5;
  if (/[ñ¿¡]/i.test(text)) scores["es-ES"] += 2.5;
  if (/\b(i'm|don't|it's|i've|we're)\b/i.test(text)) scores["en-US"] += 2.5;

  const ranked = (Object.entries(scores) as [ReplyLang, number][]).sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  if (!best || best[1] < 2) return null;
  if (second && best[1] - second[1] < 1) return null;
  return best[0];
}

/**
 * Idioma predominante de um conjunto de falas recentes (manifestações
 * proativas seguem o idioma predominante da sessão).
 */
export function dominantLang(texts: string[], fallback: ReplyLang = "pt-BR"): ReplyLang {
  const tally: Record<ReplyLang, number> = { "pt-BR": 0, "en-US": 0, "es-ES": 0 };
  let any = false;
  for (const t of texts) {
    const d = detectLang(t);
    if (d) {
      tally[d] += 1;
      any = true;
    }
  }
  if (!any) return fallback;
  return (Object.entries(tally) as [ReplyLang, number][]).sort((a, b) => b[1] - a[1])[0]![0];
}
