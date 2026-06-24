export type ThemeId =
  | "charcoal-ember"
  | "midnight-indigo"
  | "noir-gold"
  | "emerald-prestige"
  | "paper-ink"
  | "cloud-sky"
  | "sunset-blaze";

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  tagline: string;
  mood: "escuro" | "claro" | "vibrante" | "sóbrio";
  swatches: [string, string, string, string];
};

export const THEMES: ThemeMeta[] = [
  {
    id: "charcoal-ember",
    name: "Charcoal & Ember",
    tagline: "Escuro premium · brasa",
    mood: "escuro",
    swatches: ["#1a1a1a", "#2d2d2d", "#4a4a4a", "#e85d3a"],
  },
  {
    id: "midnight-indigo",
    name: "Midnight Indigo",
    tagline: "Escuro · noite elétrica",
    mood: "escuro",
    swatches: ["#0a0a1a", "#141432", "#1e1e5a", "#6366f1"],
  },
  {
    id: "noir-gold",
    name: "Noir & Gold",
    tagline: "Escuro · luxo editorial",
    mood: "sóbrio",
    swatches: ["#0d0d0d", "#1a1a1a", "#c9a84c", "#f0d78c"],
  },
  {
    id: "emerald-prestige",
    name: "Emerald Prestige",
    tagline: "Escuro · floresta dourada",
    mood: "sóbrio",
    swatches: ["#0a1f1a", "#0d4a39", "#c9a84c", "#f5f0e0"],
  },
  {
    id: "paper-ink",
    name: "Paper & Ink",
    tagline: "Claro · tinta sobre papel",
    mood: "claro",
    swatches: ["#f5f3ee", "#e8e4dd", "#2d2d2d", "#0d0d0d"],
  },
  {
    id: "cloud-sky",
    name: "Cloud Sky",
    tagline: "Claro · ar e azul",
    mood: "claro",
    swatches: ["#fafbfc", "#e8ecf1", "#94a3b8", "#3b82f6"],
  },
  {
    id: "sunset-blaze",
    name: "Sunset Blaze",
    tagline: "Vibrante · pôr do sol",
    mood: "vibrante",
    swatches: ["#fff4ec", "#ffd9b8", "#e84393", "#ff6b35"],
  },
];

export const DEFAULT_THEME: ThemeId = "charcoal-ember";
const STORAGE_KEY = "personal-ia:theme";

export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeId | null;
  if (stored && THEMES.some((t) => t.id === stored)) return stored;
  return DEFAULT_THEME;
}

export function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  const isLight = theme === "paper-ink" || theme === "cloud-sky" || theme === "sunset-blaze";
  root.classList.toggle("dark", !isLight);
  root.classList.toggle("light", isLight);
}

export function setTheme(theme: ThemeId) {
  applyTheme(theme);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent("personal-ia:theme", { detail: theme }));
  }
}

// Inline script to set theme pre-paint and avoid FOUC.
export const THEME_BOOT_SCRIPT = `
(function(){try{
  var t = localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || ${JSON.stringify(DEFAULT_THEME)};
  var light = (t === 'paper-ink' || t === 'cloud-sky' || t === 'sunset-blaze');
  var r = document.documentElement;
  r.dataset.theme = t;
  r.classList.toggle('dark', !light);
  r.classList.toggle('light', light);
}catch(e){}})();
`;
