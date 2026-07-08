// ---------------------------------------------------------------------------
// MOCK DATA — dados fake em memória para desenvolvimento offline (VITE_USE_MOCKS).
// NÃO é usado em produção. Edite à vontade para popular telas.
// Ative com: npm run dev:mock   (ou VITE_USE_MOCKS=true)
// ---------------------------------------------------------------------------

export const MOCK_USER_ID = "de000000-0000-4000-8000-000000000001";

const now = new Date();
const iso = (d: Date = now) => d.toISOString();
const today = iso().slice(0, 10); // YYYY-MM-DD
const daysAgo = (n: number) => iso(new Date(now.getTime() - n * 864e5));

// Usuário fake "logado". Formato compatível com supabase.auth.getUser().
export const MOCK_USER = {
  id: MOCK_USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "demo@vertical.vision",
  phone: "",
  app_metadata: { provider: "mock", providers: ["mock"] },
  user_metadata: { display_name: "Demo Player" },
  created_at: daysAgo(30),
  updated_at: iso(),
  identities: [],
} as const;

export const MOCK_SESSION = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(now.getTime() / 1000) + 3600,
  user: MOCK_USER,
} as const;

// Seed por tabela. Tabelas não listadas caem no default [] (telas vazias, sem crash).
export const SEED: Record<string, any[]> = {
  profiles: [
    {
      id: MOCK_USER_ID,
      display_name: "Demo Player",
      behavioral_class: "Guardião",
      behavior_scores: null,
      brasas: 120,
      level: "Aprendiz",
      level_track: "disciplina",
      xp: 640,
      streak: 5,
      onboarding_completed: true,
      onboarding_completed_at: daysAgo(29),
      friend_code: "DEMO-1234",
      age: 28,
      gender: "prefiro-nao-dizer",
      goal: "Construir consistência e clareza mental",
      height_cm: 178,
      weight_kg: 74,
      days_per_week: 5,
      time_per_day_min: 45,
      phone: null,
      phone_country: "BR",
      created_at: daysAgo(30),
      updated_at: iso(),
    },
  ],

  habits: [
    { id: "hab-1", user_id: MOCK_USER_ID, title: "Beber 2L de água", icon: "droplet", area_slug: "cozinha", frequency: "daily", target: 1, target_per_week: 7, active: true, created_at: daysAgo(20), updated_at: iso() },
    { id: "hab-2", user_id: MOCK_USER_ID, title: "Treinar", icon: "dumbbell", area_slug: "treino", frequency: "weekly", target: 5, target_per_week: 5, active: true, created_at: daysAgo(20), updated_at: iso() },
    { id: "hab-3", user_id: MOCK_USER_ID, title: "Meditar 10min", icon: "brain", area_slug: "mental", frequency: "daily", target: 1, target_per_week: 7, active: true, created_at: daysAgo(18), updated_at: iso() },
    { id: "hab-4", user_id: MOCK_USER_ID, title: "Ler um livro", icon: "book", area_slug: "mental", frequency: "monthly", target: 2, target_per_week: 1, active: true, created_at: daysAgo(15), updated_at: iso() },
  ],

  habit_logs: [
    { id: "hl-1", user_id: MOCK_USER_ID, habit_id: "hab-1", log_date: today, created_at: iso() },
    { id: "hl-2", user_id: MOCK_USER_ID, habit_id: "hab-2", log_date: today, created_at: iso() },
  ],

  user_missions: [
    { id: "mis-1", user_id: MOCK_USER_ID, title: "Caminhar 30min", area_slug: "treino", mission_type: "daily", scheduled_time: "07:00:00", weekday_mask: 127, remind_before_min: 15, xp_reward: 20, notes: null, active: true, archived_at: null, created_at: daysAgo(10), updated_at: iso() },
    { id: "mis-2", user_id: MOCK_USER_ID, title: "Ler 10 páginas", area_slug: "mental", mission_type: "daily", scheduled_time: "21:00:00", weekday_mask: 127, remind_before_min: 10, xp_reward: 15, notes: null, active: true, archived_at: null, created_at: daysAgo(9), updated_at: iso() },
    { id: "mis-3", user_id: MOCK_USER_ID, title: "Preparar marmita", area_slug: "cozinha", mission_type: "weekly", scheduled_time: "18:00:00", weekday_mask: 64, remind_before_min: 30, xp_reward: 40, notes: null, active: true, archived_at: null, created_at: daysAgo(8), updated_at: iso() },
  ],

  daily_quests: [
    { id: "dq-1", user_id: MOCK_USER_ID, quest_date: today, title: "Foco do dia: 1 hábito-chave", subtitle: "Escolha o que mais importa hoje", area_slug: "mental", status: "pending", effort: 2, xp_reward: 30, note: null, completed_at: null, created_at: iso(), updated_at: iso() },
  ],

  area_missions: [
    { id: "am-1", area_slug: "treino", title: "3 treinos nesta semana", subtitle: "Constância acima de intensidade", class_affinity: ["Guardião"], weekly_target: 3, xp_reward: 60, sort_order: 1, active: true, created_at: daysAgo(30), updated_at: iso() },
    { id: "am-2", area_slug: "mental", title: "5 registros no diário", subtitle: "Clareza vem da escrita", class_affinity: ["Guardião"], weekly_target: 5, xp_reward: 50, sort_order: 1, active: true, created_at: daysAgo(30), updated_at: iso() },
    { id: "am-3", area_slug: "cozinha", title: "Cozinhar 4 refeições", subtitle: "Você no controle do prato", class_affinity: ["Guardião"], weekly_target: 4, xp_reward: 55, sort_order: 1, active: true, created_at: daysAgo(30), updated_at: iso() },
  ],

  area_progress: [
    { id: "ap-1", user_id: MOCK_USER_ID, area_slug: "treino", level: 3, xp: 220, meta: {}, created_at: daysAgo(30), updated_at: iso() },
    { id: "ap-2", user_id: MOCK_USER_ID, area_slug: "mental", level: 2, xp: 140, meta: {}, created_at: daysAgo(30), updated_at: iso() },
    { id: "ap-3", user_id: MOCK_USER_ID, area_slug: "cozinha", level: 2, xp: 90, meta: {}, created_at: daysAgo(30), updated_at: iso() },
  ],

  notifications: [
    { id: "ntf-1", user_id: MOCK_USER_ID, kind: "mission_due", title: "Missão a caminho", body: "Caminhar 30min começa às 07:00", link: "/missoes", ref_id: "mis-1", dedupe_key: null, read_at: null, pushed_at: null, created_at: daysAgo(0) },
    { id: "ntf-2", user_id: MOCK_USER_ID, kind: "streak", title: "Streak de 5 dias! 🔥", body: "Continue amanhã para chegar a 6", link: "/progresso", ref_id: null, dedupe_key: null, read_at: null, pushed_at: null, created_at: daysAgo(0) },
    { id: "ntf-3", user_id: MOCK_USER_ID, kind: "social", title: "Novo comentário", body: "Alguém interagiu com seu post", link: "/social", ref_id: null, dedupe_key: null, read_at: daysAgo(1), pushed_at: null, created_at: daysAgo(1) },
  ],

  notification_prefs: [
    { user_id: MOCK_USER_ID, push_enabled: true, allow_mission: true, allow_streak: true, allow_ritual: true, allow_social: true, allow_orientador: true, morning_hour: 7, night_hour: 22, quiet_start: 23, quiet_end: 6, created_at: daysAgo(20), updated_at: iso() },
  ],

  user_achievements: [
    { id: "ua-1", user_id: MOCK_USER_ID, achievement_id: "first-step", seen: true, unlocked_at: daysAgo(28) },
    { id: "ua-2", user_id: MOCK_USER_ID, achievement_id: "week-streak", seen: false, unlocked_at: daysAgo(2) },
  ],

  oracle_messages: [
    { id: "om-1", user_id: MOCK_USER_ID, role: "assistant", content: "Bem-vindo de volta, Demo. Qual é o foco de hoje?", created_at: daysAgo(0) },
  ],

  mental_journal: [
    { id: "mj-1", user_id: MOCK_USER_ID, log_date: today, gratitudes: ["Saúde", "Tempo para treinar"], limiting_belief: "Não tenho disciplina", reframe: "Estou construindo disciplina um dia de cada vez", created_at: iso(), updated_at: iso() },
  ],
};

// RPCs mockados (supabase.rpc). Default: null.
export const RPC_RESULTS: Record<string, unknown> = {
  generate_nudges_for: 2,
  generate_nudges_all_users: 0,
  has_active_perk: false,
  purchase_shop_item: { ok: true },
  orientador_student_snapshot: null,
  import_wearable_samples: { imported: 0 },
};
