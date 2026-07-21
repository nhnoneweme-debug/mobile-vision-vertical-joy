// Parser determinístico de intenção da fala livre no /executar.
// Reconhece três comandos: concluir, estender +N min, pular.
// Sem IA — regex simples cobre 90% dos casos e é previsível/barato.

export type ExecuteIntent =
  | { kind: "done" }
  | { kind: "extend"; minutes: number }
  | { kind: "skip" }
  | { kind: "note"; text: string };

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NUM_WORDS: Record<string, number> = {
  cinco: 5, dez: 10, quinze: 15, vinte: 20, trinta: 30, quarenta: 40,
  sessenta: 60, "meia hora": 30, "uma hora": 60,
};

function parseMinutes(s: string): number | null {
  // "20", "20 min", "20 minutos", "vinte minutos", "meia hora"
  const numMatch = s.match(/(\d{1,3})\s*(m|min|minutos?|mn)?/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    if (Number.isFinite(n) && n > 0 && n <= 240) return n;
  }
  for (const [word, n] of Object.entries(NUM_WORDS)) {
    if (s.includes(word)) return n;
  }
  return null;
}

export function parseExecuteIntent(raw: string): ExecuteIntent | null {
  const s = normalize(raw);
  if (!s) return null;

  // concluir
  if (/(termin(ei|amos|ado)|conclu(i|imos|ido)|feito|prontinho|acabei|ja fiz)/.test(s)) {
    return { kind: "done" };
  }

  // pular
  if (/(pul(ar|a)|nao vai rolar|deixa pra la|cancela|nao consigo hoje)/.test(s)) {
    return { kind: "skip" };
  }

  // estender / mais tempo
  if (/(mais|estend[eo]|prolong[ao]|adiciona|soma|so mais|preciso de mais)/.test(s)) {
    const m = parseMinutes(s);
    if (m) return { kind: "extend", minutes: m };
  }

  // "+20", "+ 20 min"
  const plusMatch = s.match(/\+\s*(\d{1,3})/);
  if (plusMatch) {
    const n = Number(plusMatch[1]);
    if (n > 0 && n <= 240) return { kind: "extend", minutes: n };
  }

  // fallback: vira nota de voz
  if (s.length >= 3) return { kind: "note", text: raw.trim().slice(0, 500) };
  return null;
}
