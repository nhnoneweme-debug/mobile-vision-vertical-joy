import { supabase } from "@/integrations/supabase/client";

export type MealPlanStatus = "active" | "archived" | "draft";
export type MealLogStatus = "eaten" | "skipped" | "partial";

export type MealPlan = {
  id: string;
  user_id: string;
  title: string;
  goal: string | null;
  kcal_target: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
};

export type MealPlanItem = {
  id: string;
  plan_id: string;
  day_of_week: number | null;
  meal_slot: string;
  position: number;
  name: string;
  description: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

export type MealLog = {
  id: string;
  user_id: string;
  plan_item_id: string | null;
  log_date: string;
  status: string;
  note: string | null;
  created_at: string;
};

export type MealPlanWithItems = MealPlan & { items: MealPlanItem[] };

export type TodayMeal = MealPlanItem & {
  logged: boolean;
  log_id: string | null;
  log_status: string | null;
};

export type UpsertMealPlanInput = {
  id?: string;
  title: string;
  goal?: string | null;
  kcal_target?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  status?: MealPlanStatus;
  source?: string;
  items?: Array<Omit<MealPlanItem, "id" | "plan_id"> & { id?: string }>;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayISO(): string {
  return fmt(new Date());
}
function weekStartISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  d.setDate(d.getDate() + diff);
  return fmt(d);
}

export async function getActivePlan(): Promise<MealPlanWithItems | null> {
  const { data: user } = await supabase.auth.getUser();
  const uid = user.user?.id;
  if (!uid) return null;

  const { data: plan, error } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("user_id", uid)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!plan) return null;

  const { data: items, error: itemsErr } = await supabase
    .from("meal_plan_items")
    .select("*")
    .eq("plan_id", plan.id)
    .order("day_of_week", { ascending: true, nullsFirst: true })
    .order("position", { ascending: true });
  if (itemsErr) throw itemsErr;

  return { ...(plan as MealPlan), items: (items ?? []) as MealPlanItem[] };
}

export async function getTodayMeals(): Promise<TodayMeal[]> {
  const { data: user } = await supabase.auth.getUser();
  const uid = user.user?.id;
  if (!uid) return [];

  const plan = await getActivePlan();
  if (!plan) return [];

  const dow = new Date().getDay();
  const today = todayISO();
  const items = plan.items.filter(
    (i) => i.day_of_week === null || i.day_of_week === dow,
  );
  if (items.length === 0) return [];

  const ids = items.map((i) => i.id);
  const { data: logs, error } = await supabase
    .from("meal_logs")
    .select("id, plan_item_id, status")
    .eq("user_id", uid)
    .eq("log_date", today)
    .in("plan_item_id", ids);
  if (error) throw error;

  return items.map((it) => {
    const log = (logs ?? []).find((l) => l.plan_item_id === it.id);
    return {
      ...it,
      logged: Boolean(log),
      log_id: log?.id ?? null,
      log_status: (log?.status as string | undefined) ?? null,
    };
  });
}

export async function logMeal(
  itemId: string,
  status: MealLogStatus = "eaten",
  note?: string,
): Promise<MealLog> {
  const { data: user } = await supabase.auth.getUser();
  const uid = user.user?.id;
  if (!uid) throw new Error("unauthenticated");

  const { data, error } = await supabase
    .from("meal_logs")
    .upsert(
      {
        user_id: uid,
        plan_item_id: itemId,
        log_date: todayISO(),
        status,
        note: note ?? null,
      },
      { onConflict: "user_id,plan_item_id,log_date" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as MealLog;
}

export async function getWeeklyAdherence(): Promise<{
  done: number;
  target: number;
  pct: number;
}> {
  const { data: user } = await supabase.auth.getUser();
  const uid = user.user?.id;
  if (!uid) return { done: 0, target: 0, pct: 0 };

  const plan = await getActivePlan();
  if (!plan) return { done: 0, target: 0, pct: 0 };

  // Target: itens sem day_of_week valem para todos os 7 dias; itens com dia valem 1x.
  const target = plan.items.reduce(
    (s, it) => s + (it.day_of_week === null ? 7 : 1),
    0,
  );
  if (target === 0) return { done: 0, target: 0, pct: 0 };

  const start = weekStartISO();
  const end = todayISO();
  const ids = plan.items.map((i) => i.id);
  const { data: logs, error } = await supabase
    .from("meal_logs")
    .select("id")
    .eq("user_id", uid)
    .eq("status", "eaten")
    .gte("log_date", start)
    .lte("log_date", end)
    .in("plan_item_id", ids);
  if (error) throw error;

  const done = logs?.length ?? 0;
  const pct = Math.max(0, Math.min(100, Math.round((done / target) * 100)));
  return { done, target, pct };
}

export async function upsertPlan(
  plan: UpsertMealPlanInput,
): Promise<MealPlanWithItems> {
  const { data: user } = await supabase.auth.getUser();
  const uid = user.user?.id;
  if (!uid) throw new Error("unauthenticated");

  const payload = {
    user_id: uid,
    title: plan.title,
    goal: plan.goal ?? null,
    kcal_target: plan.kcal_target ?? null,
    protein_g: plan.protein_g ?? null,
    carbs_g: plan.carbs_g ?? null,
    fat_g: plan.fat_g ?? null,
    status: plan.status ?? "active",
    source: plan.source ?? "manual",
  };

  let planRow: MealPlan;
  if (plan.id) {
    const { data, error } = await supabase
      .from("meal_plans")
      .update(payload)
      .eq("id", plan.id)
      .select("*")
      .single();
    if (error) throw error;
    planRow = data as MealPlan;
  } else {
    const { data, error } = await supabase
      .from("meal_plans")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    planRow = data as MealPlan;
  }

  if (plan.items) {
    // Substitui os itens: apaga os antigos e insere os novos.
    const { error: delErr } = await supabase
      .from("meal_plan_items")
      .delete()
      .eq("plan_id", planRow.id);
    if (delErr) throw delErr;

    if (plan.items.length > 0) {
      const rows = plan.items.map((it, idx) => ({
        plan_id: planRow.id,
        day_of_week: it.day_of_week ?? null,
        meal_slot: it.meal_slot,
        position: it.position ?? idx,
        name: it.name,
        description: it.description ?? null,
        kcal: it.kcal ?? null,
        protein_g: it.protein_g ?? null,
        carbs_g: it.carbs_g ?? null,
        fat_g: it.fat_g ?? null,
      }));
      const { error: insErr } = await supabase
        .from("meal_plan_items")
        .insert(rows);
      if (insErr) throw insErr;
    }
  }

  const { data: items, error: itemsErr } = await supabase
    .from("meal_plan_items")
    .select("*")
    .eq("plan_id", planRow.id)
    .order("day_of_week", { ascending: true, nullsFirst: true })
    .order("position", { ascending: true });
  if (itemsErr) throw itemsErr;

  return { ...planRow, items: (items ?? []) as MealPlanItem[] };
}

export async function archivePlan(planId: string): Promise<void> {
  const { error } = await supabase
    .from("meal_plans")
    .update({ status: "archived" })
    .eq("id", planId);
  if (error) throw error;
}
