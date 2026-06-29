import { supabase } from "@/integrations/supabase/client";

export type CrystalMode = "temporal" | "conditional" | "permanent";

export type PowerCrystal = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  effect_type: string;
  rarity: "common" | "rare" | "epic" | "legendary";
};

export type UserCrystal = {
  id: string;
  crystal_id: string;
  mode: CrystalMode;
  acquired_at: string;
  expires_at: string | null;
  condition: Record<string, unknown> | null;
  active: boolean;
  crystal: PowerCrystal;
  is_active_now: boolean;
};

export async function listAllCrystals(): Promise<PowerCrystal[]> {
  const { data, error } = await supabase
    .from("power_crystals")
    .select("id, code, name, description, icon, effect_type, rarity")
    .eq("active", true)
    .order("rarity");
  if (error) throw error;
  return (data ?? []) as PowerCrystal[];
}

export async function listMyCrystals(): Promise<UserCrystal[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase
    .from("user_crystals")
    .select(
      "id, crystal_id, mode, acquired_at, expires_at, condition, active, power_crystals!inner(id, code, name, description, icon, effect_type, rarity)",
    )
    .eq("user_id", u.user.id)
    .order("acquired_at", { ascending: false });
  if (error) throw error;
  const now = new Date();
  return (data ?? []).map((row) => {
    const crystal = (row as unknown as { power_crystals: PowerCrystal }).power_crystals;
    let active = row.active === true;
    if (active && row.mode === "temporal") {
      active = !row.expires_at || new Date(row.expires_at) > now;
    }
    return {
      id: row.id,
      crystal_id: row.crystal_id,
      mode: row.mode as CrystalMode,
      acquired_at: row.acquired_at,
      expires_at: row.expires_at,
      condition: (row.condition as Record<string, unknown> | null) ?? null,
      active: row.active,
      crystal,
      is_active_now: active,
    };
  });
}

export async function isCrystalActive(code: string): Promise<boolean> {
  const mine = await listMyCrystals();
  return mine.some((c) => c.crystal.code === code && c.is_active_now);
}

export function rarityClass(rarity: PowerCrystal["rarity"]) {
  switch (rarity) {
    case "legendary":
      return "border-amber-400/70 bg-amber-400/10 text-amber-300";
    case "epic":
      return "border-fuchsia-400/60 bg-fuchsia-400/10 text-fuchsia-300";
    case "rare":
      return "border-sky-400/60 bg-sky-400/10 text-sky-300";
    default:
      return "border-border bg-muted/30 text-foreground";
  }
}
