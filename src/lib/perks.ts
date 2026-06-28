import { supabase } from "@/integrations/supabase/client";
import type { BehavioralClass } from "./behavior";

export type SkillPerk = {
  id: string;
  class: string;
  tier: number;
  unlock_level: number;
  title: string;
  description: string;
  sort_order: number;
};

export type PerkWithStatus = SkillPerk & { unlocked: boolean; unlocked_at: string | null };

export function playerLevel(xp: number): number {
  return Math.max(1, Math.floor(xp / 500) + 1);
}

export function xpIntoLevel(xp: number): { into: number; needed: number; pct: number } {
  const into = xp % 500;
  return { into, needed: 500, pct: Math.min(100, (into / 500) * 100) };
}

export async function listClassPerks(cls: BehavioralClass): Promise<SkillPerk[]> {
  const { data, error } = await supabase
    .from("skill_perks")
    .select("*")
    .eq("class", cls)
    .order("tier", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SkillPerk[];
}

export async function listUserPerks(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("user_perks")
    .select("perk_id")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.perk_id as string));
}

export async function checkPerkUnlocks(): Promise<number> {
  const { data, error } = await supabase.rpc("check_perk_unlocks");
  if (error) throw error;
  return Number(data ?? 0);
}

export function currentTitle(cls: BehavioralClass, unlockedTiers: number[]): string {
  if (unlockedTiers.length === 0) return "Iniciante";
  const max = Math.max(...unlockedTiers);
  const titles: Record<BehavioralClass, string[]> = {
    executor: ["Aprendiz da Ação", "Executor de Campo", "Tático de Ferro", "Mestre Executor", "Vanguarda", "Arquiteto da Ação"],
    estrategista: ["Aprendiz do Plano", "Tático Semanal", "Mente de Tabuleiro", "Mestre Estrategista", "Grande Estrategista", "Arquiteto do Plano"],
    explorador: ["Aprendiz do Mapa", "Andarilho", "Caçador de Rotas", "Mestre Explorador", "Cartógrafo", "Arquiteto da Jornada"],
    guardiao: ["Aprendiz do Cuidado", "Sentinela", "Guarda Constante", "Mestre Guardião", "Protetor Maior", "Arquiteto do Zelo"],
    visionario: ["Aprendiz da Visão", "Sonhador Lúcido", "Vidente de Rota", "Mestre Visionário", "Profeta de Si", "Arquiteto do Horizonte"],
  };
  return titles[cls]?.[max - 1] ?? "Aprendiz";
}
