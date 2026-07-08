// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { VitePWA } from "vite-plugin-pwa";

// O mcpPlugin tem um bug de separador de caminho no Windows (compara C:/ com C:\...).
// Pulamos ele no modo mock (offline) E em qualquer build/dev rodando no Windows.
// Como o build de produção do Lovable roda em LINUX, o plugin segue ativo lá —
// esta exceção afeta apenas a máquina local Windows.
const USE_MOCKS =
  process.argv.includes("mock") || process.env.VITE_USE_MOCKS === "true";
const IS_WINDOWS = process.platform === "win32";
const SKIP_MCP = USE_MOCKS || IS_WINDOWS;

const PUBLIC_SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://bqqxvhvztzpvrjfbkcnr.supabase.co";

const PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcXh2aHZ6dHpwdnJqZmJrY25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNTY2NTQsImV4cCI6MjA5NzgzMjY1NH0.adojIpquZwyvRsAV7hth9ddLNmqjG8pZNL1SEWmlJ1w";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Preset do Nitro condicional: quando NITRO_PRESET está definido (ex.: node-server para self-host),
  // repassa ao wrapper. Sem a var, o build padrão da Lovable/Cloudflare permanece intacto.
  nitro: process.env.NITRO_PRESET ? { preset: process.env.NITRO_PRESET } : undefined,
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(PUBLIC_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    },
    plugins: [
      ...(SKIP_MCP ? [] : [mcpPlugin()]),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        includeAssets: ["favicon-64.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"],
        manifest: false,
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/api\//, /^\/~oauth/, /^\/mcp/, /^\/\.well-known\//, /^\/\.lovable\//],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "pia-pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\.(?:js|css|woff2|png|jpg|jpeg|svg|webp|avif)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "pia-assets",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
              handler: "CacheFirst",
              options: {
                cacheName: "pia-fonts",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
      }),
    ],
  },
});
