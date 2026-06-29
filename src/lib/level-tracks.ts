// Trilhas de identificação de níveis.
// Math é igual em todas — só muda a nomenclatura.
// 10 patentes por trilha (níveis 1..10+). Acima do 10, prefixamos com "Élder".

export type LevelTrackKey =
  | "warrior_m"
  | "strategist_m"
  | "mystic_m"
  | "warrior_f"
  | "strategist_f"
  | "mystic_f";

export type LevelTrack = {
  key: LevelTrackKey;
  label: string;
  gender: "m" | "f";
  flavor: string;
  ranks: string[];
};

export const LEVEL_TRACKS: Record<LevelTrackKey, LevelTrack> = {
  warrior_m: {
    key: "warrior_m",
    label: "Guerreiro",
    gender: "m",
    flavor: "Força, disciplina e honra de batalha.",
    ranks: [
      "Aprendiz",
      "Soldado",
      "Veterano",
      "Cavaleiro",
      "Capitão",
      "Comandante",
      "Senhor da Guerra",
      "Lorde",
      "Lenda",
      "Mito",
    ],
  },
  strategist_m: {
    key: "strategist_m",
    label: "Estrategista",
    gender: "m",
    flavor: "Planejamento, lucidez e visão de longo prazo.",
    ranks: [
      "Cadete",
      "Tenente",
      "Capitão",
      "Major",
      "Coronel",
      "General",
      "Marechal",
      "Estadista",
      "Sábio",
      "Oráculo",
    ],
  },
  mystic_m: {
    key: "mystic_m",
    label: "Místico",
    gender: "m",
    flavor: "Intuição, consciência e energia interna.",
    ranks: [
      "Iniciado",
      "Adepto",
      "Arcano",
      "Conjurador",
      "Mago",
      "Arquimago",
      "Vidente",
      "Profeta",
      "Avatar",
      "Divino",
    ],
  },
  warrior_f: {
    key: "warrior_f",
    label: "Guerreira",
    gender: "f",
    flavor: "Força, disciplina e honra de batalha.",
    ranks: [
      "Aprendiz",
      "Soldada",
      "Veterana",
      "Cavaleira",
      "Capitã",
      "Comandante",
      "Senhora da Guerra",
      "Imperatriz",
      "Lenda",
      "Mito",
    ],
  },
  strategist_f: {
    key: "strategist_f",
    label: "Estrategista",
    gender: "f",
    flavor: "Planejamento, lucidez e visão de longo prazo.",
    ranks: [
      "Cadete",
      "Tenente",
      "Capitã",
      "Majora",
      "Coronela",
      "Generala",
      "Marechala",
      "Estadista",
      "Sábia",
      "Oráculo",
    ],
  },
  mystic_f: {
    key: "mystic_f",
    label: "Mística",
    gender: "f",
    flavor: "Intuição, consciência e energia interna.",
    ranks: [
      "Iniciada",
      "Adepta",
      "Arcana",
      "Conjuradora",
      "Maga",
      "Arquimaga",
      "Vidente",
      "Profetisa",
      "Avatar",
      "Divina",
    ],
  },
};

export const TRACK_OPTIONS: LevelTrack[] = [
  LEVEL_TRACKS.warrior_m,
  LEVEL_TRACKS.strategist_m,
  LEVEL_TRACKS.mystic_m,
  LEVEL_TRACKS.warrior_f,
  LEVEL_TRACKS.strategist_f,
  LEVEL_TRACKS.mystic_f,
];

export function isLevelTrackKey(value: unknown): value is LevelTrackKey {
  return typeof value === "string" && value in LEVEL_TRACKS;
}

export function getTrack(key: string | null | undefined): LevelTrack {
  if (key && isLevelTrackKey(key)) return LEVEL_TRACKS[key];
  return LEVEL_TRACKS.warrior_m;
}

/** Rank name for a given XP-derived level (1-based). */
export function rankFor(track: LevelTrack, level: number): string {
  const idx = Math.max(0, Math.min(track.ranks.length - 1, level - 1));
  const base = track.ranks[idx];
  if (level <= track.ranks.length) return base;
  const overflow = level - track.ranks.length;
  return `${base} · Élder ${overflow}`;
}

export function rankFromXP(track: LevelTrack, xp: number): string {
  const level = Math.max(1, Math.floor(xp / 500) + 1);
  return rankFor(track, level);
}
