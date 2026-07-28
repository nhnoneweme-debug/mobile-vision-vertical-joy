import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getProfileTool from "./tools/get-profile";
import listMissionsTool from "./tools/list-missions";
import listHabitsTool from "./tools/list-habits";
import listNotificationsTool from "./tools/list-notifications";
import generateNudgesTool from "./tools/generate-nudges";
import createHabitTool from "./tools/create-habit";
import logHabitTool from "./tools/log-habit";
import createMissionTool from "./tools/create-mission";
import completeMissionTool from "./tools/complete-mission";
import undoCompletionTool from "./tools/undo-completion";
import planDayTool from "./tools/plan-day";

// Build the OAuth issuer from the direct Supabase host (Vite inlines this at
// build time). The `.lovable.cloud` proxy that SUPABASE_URL becomes on publish
// would fail RFC 8414 issuer discovery.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "personal-ia-mcp",
  title: "Weme",
  version: "0.1.0",
  instructions:
    "Ferramentas do Weme para o usuário autenticado. Leitura: perfil, missões, hábitos, notificações. Escrita: criar hábitos e compromissos, registrar conclusões, desfazer check-ins e planejar o dia em blocos. Sempre consulte list_missions/list_habits para obter IDs antes de concluir ou desfazer algo.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getProfileTool,
    listMissionsTool,
    listHabitsTool,
    listNotificationsTool,
    generateNudgesTool,
    createHabitTool,
    logHabitTool,
    createMissionTool,
    completeMissionTool,
    undoCompletionTool,
    planDayTool,
  ],
});
