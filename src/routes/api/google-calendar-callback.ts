import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/api/google-calendar-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        if (error || !code) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/missoes?gcal=error&reason=${encodeURIComponent(error || "no_code")}`,
            },
          });
        }
        return new Response(null, {
          status: 302,
          headers: {
            Location: `/missoes?gcal=success&code=${encodeURIComponent(code)}`,
          },
        });
      },
    },
  },
});
