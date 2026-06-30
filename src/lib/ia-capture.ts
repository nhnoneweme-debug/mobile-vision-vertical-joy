// Shared types and whitelist for the IA-Coletora (AI-driven data capture).
// The AI proposes writes; the user confirms; the server applies them under RLS.

export type AllowedAction =
  | "habit.create"
  | "habit_log.today"
  | "quest.create"
  | "ritual.upsert"
  | "goal.create"
  | "scheduled_quest.create"
  | "area_mission.complete"
  | "profile.update";

export type Proposal = {
  audit_id: string;
  action: AllowedAction;
  table: string;
  payload: Record<string, unknown>;
  summary: string;
  auto_applied?: boolean;
  apply_error?: string;
};

export const ALLOWED_ACTIONS: AllowedAction[] = [
  "habit.create",
  "habit_log.today",
  "quest.create",
  "ritual.upsert",
  "goal.create",
  "scheduled_quest.create",
  "area_mission.complete",
  "profile.update",
];

export const ACTION_TO_TABLE: Record<AllowedAction, string> = {
  "habit.create": "habits",
  "habit_log.today": "habit_logs",
  "quest.create": "daily_quests",
  "ritual.upsert": "ritual_logs",
  "goal.create": "strategic_goals",
  "scheduled_quest.create": "scheduled_quests",
  "area_mission.complete": "area_mission_logs",
  "profile.update": "profiles",
};

export const PROFILE_UPDATABLE_FIELDS = new Set([
  "display_name",
  "goal",
  "time_per_day_min",
  "days_per_week",
  "phone",
  "phone_country",
  "level_track",
  "height_cm",
  "weight_kg",
  "age",
]);
