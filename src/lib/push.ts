// Client helpers para inscrição em Web Push (VAPID)
import { supabase } from '@/integrations/supabase/client';

// Chave pública VAPID (segura para expor no cliente)
const VAPID_PUBLIC_KEY =
  'BHlmopr66irAahFC-eZ2qfR_DusaVF1jtlOV-47iooHWm1KVsEJcoWYVOiuDR5qQA-fBRKiGKpmSOXoyqAqPNg0';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied';
  return Notification.permission;
}

async function registerPushSW(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/push-sw.js');
  if (existing) return existing;
  return navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
}

export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) return { ok: false, error: 'not_supported' };
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, error: 'permission_denied' };

    const reg = await registerPushSW();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    const endpoint = json.endpoint ?? sub.endpoint;
    const p256dh = json.keys?.p256dh ?? arrayBufferToBase64(sub.getKey('p256dh'));
    const auth = json.keys?.auth ?? arrayBufferToBase64(sub.getKey('auth'));

    const { data: sess } = await supabase.auth.getUser();
    const uid = sess.user?.id;
    if (!uid) return { ok: false, error: 'not_authenticated' };

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: uid,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent.slice(0, 240),
      },
      { onConflict: 'user_id,endpoint' },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function disablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) return { ok: false, error: 'not_supported' };
  try {
    const reg = await navigator.serviceWorker.getRegistration('/push-sw.js');
    const sub = await reg?.pushManager.getSubscription();
    const endpoint = sub?.endpoint;
    if (sub) await sub.unsubscribe();
    if (endpoint) {
      const { data: sess } = await supabase.auth.getUser();
      const uid = sess.user?.id;
      if (uid) {
        await supabase.from('push_subscriptions').delete().eq('user_id', uid).eq('endpoint', endpoint);
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function hasActivePushSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration('/push-sw.js');
  const sub = await reg?.pushManager.getSubscription();
  return Boolean(sub);
}
