import { supabase } from "@/integrations/supabase/client";

export type ShopCategory = "frame" | "title" | "avatar_icon" | "theme" | "perk";
export type ShopKind = "cosmetic" | "perk" | "bundle" | "seasonal";

export type ShopItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: ShopCategory;
  kind: ShopKind;
  price: number;
  required_level: number;
  duration_hours: number | null;
  perk_code: string | null;
  season_tag: string | null;
  stock: number | null;
  available_from: string | null;
  available_until: string | null;
  bundle_items: string[];
  icon: string | null;
  featured: boolean;
  payload: Record<string, unknown>;
  active: boolean;
};

export type InventoryItem = {
  id: string;
  item_id: string;
  equipped: boolean;
  acquired_at: string;
  expires_at: string | null;
  uses_left: number | null;
  source: string;
  item: ShopItem;
};

export type BrasasEvent = {
  id: string;
  amount: number;
  source: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export type PurchaseResult =
  | { ok: true; balance: number; expires_at?: string | null; kind?: ShopKind }
  | {
      ok: false;
      error: string;
      required_level?: number;
      balance?: number;
      price?: number;
    };

export async function listShopItems(): Promise<ShopItem[]> {
  const { data, error } = await supabase
    .from("shop_items")
    .select("*")
    .eq("active", true)
    .order("featured", { ascending: false })
    .order("required_level", { ascending: true })
    .order("price", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ShopItem[];
}

export async function listInventory(userId: string): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("user_inventory")
    .select("id, item_id, equipped, acquired_at, expires_at, uses_left, source, item:shop_items(*)")
    .eq("user_id", userId)
    .order("acquired_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InventoryItem[];
}

export async function listBrasasEvents(userId: string, limit = 20): Promise<BrasasEvent[]> {
  const { data, error } = await supabase
    .from("brasas_events")
    .select("id, amount, source, meta, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as BrasasEvent[];
}

export async function purchaseShopItem(itemId: string): Promise<PurchaseResult> {
  const { data, error } = await supabase.rpc("purchase_shop_item", { _item_id: itemId });
  if (error) throw error;
  return data as unknown as PurchaseResult;
}

export async function equipInventoryItem(itemId: string, equip: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc("equip_inventory_item", {
    _item_id: itemId,
    _equip: equip,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function hasActivePerk(userId: string, perkCode: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_active_perk", {
    _user: userId,
    _perk_code: perkCode,
  });
  if (error) throw error;
  return Boolean(data);
}

export type ShopTab = "featured" | "perk" | "seasonal" | "frame" | "title" | "avatar_icon" | "theme";

export const TAB_LABEL: Record<ShopTab, string> = {
  featured: "Destaques",
  perk: "Perks",
  seasonal: "Sazonal",
  frame: "Molduras",
  title: "Títulos",
  avatar_icon: "Ícones",
  theme: "Temas",
};

export const CATEGORY_LABEL: Record<ShopCategory, string> = {
  frame: "Molduras",
  title: "Títulos",
  avatar_icon: "Ícones",
  theme: "Temas",
  perk: "Perks",
};

export const SOURCE_LABEL: Record<string, string> = {
  xp_conversion: "Conversão de XP",
  shop_purchase: "Compra na loja",
  bonus: "Bônus",
  refund: "Reembolso",
  achievement: "Conquista",
};

export function isItemAvailableWindow(item: ShopItem, now = new Date()): boolean {
  if (item.available_from && new Date(item.available_from) > now) return false;
  if (item.available_until && new Date(item.available_until) < now) return false;
  return true;
}

export function timeLeft(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expirado";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
