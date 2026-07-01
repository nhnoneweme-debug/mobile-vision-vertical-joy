import webpush from 'web-push';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

let configured = false;
function configure() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:contato@vertical-vision.app';
  if (!publicKey || !privateKey) throw new Error('vapid_not_configured');
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** Notification kind, used to check per-category prefs (e.g. mission_due, night_ritual). */
  kind?: string;
}

export interface SendResult {
  ok: boolean;
  sent: number;
  removed: number;
  errors: number;
  skipped?: 'quiet_hours' | 'category_muted' | 'push_disabled';
}

function isQuietNow(startHour: number, endHour: number): boolean {
  const h = new Date().getHours();
  if (startHour === endHour) return false;
  if (startHour < endHour) return h >= startHour && h < endHour;
  // wraps midnight (e.g. 23 -> 7)
  return h >= startHour || h < endHour;
}

function categoryAllowed(
  kind: string | undefined,
  prefs: {
    allow_mission: boolean;
    allow_ritual: boolean;
    allow_streak: boolean;
    allow_orientador: boolean;
    allow_social: boolean;
  },
): boolean {
  if (!kind) return true;
  if (kind.startsWith('mission')) return prefs.allow_mission;
  if (kind.endsWith('_ritual') || kind.includes('ritual')) return prefs.allow_ritual;
  if (kind.startsWith('streak')) return prefs.allow_streak;
  if (kind.startsWith('orient')) return prefs.allow_orientador;
  if (kind.startsWith('social') || kind === 'friend_request' || kind === 'post_reaction') return prefs.allow_social;
  return true;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<SendResult> {
  configure();

  // Load prefs (tolerant to missing row -> defaults allow all, quiet 23-7)
  const { data: prefs } = await supabaseAdmin
    .from('notification_prefs')
    .select('push_enabled, quiet_start, quiet_end, allow_mission, allow_ritual, allow_streak, allow_orientador, allow_social')
    .eq('user_id', userId)
    .maybeSingle();

  const p = prefs ?? {
    push_enabled: true,
    quiet_start: 23,
    quiet_end: 7,
    allow_mission: true,
    allow_ritual: true,
    allow_streak: true,
    allow_orientador: true,
    allow_social: true,
  };

  // Only enforce push_enabled=false when the user has an explicit row
  if (prefs && p.push_enabled === false) {
    return { ok: true, sent: 0, removed: 0, errors: 0, skipped: 'push_disabled' };
  }
  if (!categoryAllowed(payload.kind, p)) {
    return { ok: true, sent: 0, removed: 0, errors: 0, skipped: 'category_muted' };
  }
  if (isQuietNow(p.quiet_start, p.quiet_end)) {
    return { ok: true, sent: 0, removed: 0, errors: 0, skipped: 'quiet_hours' };
  }

  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);
  if (error) throw error;
  if (!subs || subs.length === 0) return { ok: true, sent: 0, removed: 0, errors: 0 };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
  });
  let sent = 0;
  let removed = 0;
  let errors = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', s.id);
          removed++;
        } else {
          console.error('push send failed', status, err);
          errors++;
        }
      }
    }),
  );

  return { ok: true, sent, removed, errors };
}
