import { supabase } from "@/integrations/supabase/client";

export type ShopCategory = "frame" | "title" | "avatar_icon" | "theme";

export type ShopItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: ShopCategory;
  price: number;
  required_level: number;
  payload: Record<string, unknown>;
  active: boolean;
};

export type InventoryItem = {
  id: string;
  item_id: string;
  equipped: boolean;
  acquired_at: string;
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
  | { ok: true; balance: number }
  | { ok: false; error: string; required_level?: number; balance?: number; price?: number };

export async function listShopItems(): Promise<ShopItem[]> {
  const { data, error } = await supabase
    .from("shop_items")
    .select("*")
    .eq("active", true)
    .order("required_level", { ascending: true })
    .order("price", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ShopItem[];
}

export async function listInventory(userId: string): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("user_inventory")
    .select("id, item_id, equipped, acquired_at, item:shop_items(*)")
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

export const CATEGORY_LABEL: Record<ShopCategory, string> = {
  frame: "Molduras",
  title: "Títulos",
  avatar_icon: "Ícones",
  theme: "Temas",
};

export const SOURCE_LABEL: Record<string, string> = {
  xp_conversion: "Conversão de XP",
  shop_purchase: "Compra na loja",
  bonus: "Bônus",
  refund: "Reembolso",
};
