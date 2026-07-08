import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }

    // Gate de onboarding: se ainda não completou, força a rota /onboarding
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", data.user.id)
      .maybeSingle();

    const completed = profile?.onboarding_completed === true;
    const onOnboarding = location.pathname.startsWith("/onboarding");

    if (!completed && !onOnboarding) {
      throw redirect({ to: "/onboarding" });
    }
    if (completed && onOnboarding) {
      throw redirect({ to: "/home" });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
