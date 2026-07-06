import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getProfileTool from "./tools/get-profile";
import listMissionsTool from "./tools/list-missions";
import listHabitsTool from "./tools/list-habits";
import listNotificationsTool from "./tools/list-notifications";
import generateNudgesTool from "./tools/generate-nudges";

// Build the OAuth issuer from the direct Supabase host (Vite inlines this at
// build time). The `.lovable.cloud` proxy that SUPABASE_URL becomes on publish
// would fail RFC 8414 issuer discovery.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "personal-ia-mcp",
  title: "Personal IA",
  version: "0.1.0",
  instructions:
    "Ferramentas do Personal IA para o usuário autenticado: consultar perfil, missões, hábitos e notificações, e gerar nudges pendentes do dia.",
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
  ],
});
