// Guarded service worker registration. Never registers in dev, iframe, or
// any Lovable preview/editor context. Supports `?sw=off` kill switch.

const SW_PATH = "/sw.js";

function isPreviewHost(hostname: string): boolean {
  if (hostname.startsWith("id-preview--") || hostname.startsWith("preview--")) return true;
  if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) return true;
  if (hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com")) return true;
  if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) return true;
  return false;
}

async function unregisterAppSw() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith(SW_PATH);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    /* ignore */
  }
}

export async function registerPWA() {
  if (typeof window === "undefined") return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const url = new URL(window.location.href);
  const killed = url.searchParams.get("sw") === "off";
  const refused =
    !import.meta.env.PROD ||
    inIframe ||
    killed ||
    isPreviewHost(window.location.hostname);

  if (refused) {
    await unregisterAppSw();
    return;
  }

  try {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({ immediate: true });
  } catch {
    /* ignore */
  }
}
