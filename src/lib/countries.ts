// Lista enxuta de países com prefixo telefônico. Pode expandir depois.
export type Country = { code: string; name: string; dial: string; flag: string };

export const COUNTRIES: Country[] = [
  { code: "BR", name: "Brasil", dial: "+55", flag: "🇧🇷" },
  { code: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { code: "US", name: "Estados Unidos", dial: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canadá", dial: "+1", flag: "🇨🇦" },
  { code: "MX", name: "México", dial: "+52", flag: "🇲🇽" },
  { code: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷" },
  { code: "CL", name: "Chile", dial: "+56", flag: "🇨🇱" },
  { code: "CO", name: "Colômbia", dial: "+57", flag: "🇨🇴" },
  { code: "UY", name: "Uruguai", dial: "+598", flag: "🇺🇾" },
  { code: "PY", name: "Paraguai", dial: "+595", flag: "🇵🇾" },
  { code: "ES", name: "Espanha", dial: "+34", flag: "🇪🇸" },
  { code: "FR", name: "França", dial: "+33", flag: "🇫🇷" },
  { code: "DE", name: "Alemanha", dial: "+49", flag: "🇩🇪" },
  { code: "IT", name: "Itália", dial: "+39", flag: "🇮🇹" },
  { code: "GB", name: "Reino Unido", dial: "+44", flag: "🇬🇧" },
  { code: "IE", name: "Irlanda", dial: "+353", flag: "🇮🇪" },
  { code: "NL", name: "Holanda", dial: "+31", flag: "🇳🇱" },
  { code: "JP", name: "Japão", dial: "+81", flag: "🇯🇵" },
  { code: "AU", name: "Austrália", dial: "+61", flag: "🇦🇺" },
  { code: "AE", name: "Emirados Árabes", dial: "+971", flag: "🇦🇪" },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

/** Concatena prefixo + número (apenas dígitos). Resultado: +5511999998888 */
export function formatE164(dial: string, raw: string) {
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return "";
  return `${dial}${digits}`;
}
