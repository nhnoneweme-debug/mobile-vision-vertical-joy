// CAMADA 3.9.6 — TRAVA "SOMENTE TEXTO, SEM FALA".
//
// Quando ligada, a WiMi NUNCA emite voz: nenhuma manifestação, resposta,
// leitura automática ou botão de ler produz som. A ESCUTA não é afetada —
// microfone, transcrição e registro continuam iguais, e o diálogo segue
// normalmente por texto.
//
// A trava é consultada dentro de `speakUnified` (ponto de entrada único da
// fala), então vale para qualquer caminho: gatilhos, rituais, handover,
// leitura de blocos e amostras de voz.

const KEY = "wimi.voice.textonly.v1";

let cached: boolean | null = null;
const listeners = new Set<(on: boolean) => void>();

export function isTextOnly(): boolean {
  if (cached != null) return cached;
  try {
    cached = localStorage.getItem(KEY) === "1";
  } catch {
    cached = false;
  }
  return cached;
}

export function setTextOnly(on: boolean): void {
  cached = on;
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* storage indisponível */
  }
  listeners.forEach((fn) => fn(on));
}

export function onTextOnlyChange(fn: (on: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
