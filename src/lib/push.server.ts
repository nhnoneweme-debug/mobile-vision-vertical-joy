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
}

export interface SendResult {
  ok: boolean;
  sent: number;
  removed: number;
  errors: number;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<SendResult> {
  configure();
  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);
  if (error) throw error;
  if (!subs || subs.length === 0) return { ok: true, sent: 0, removed: 0, errors: 0 };

  const body = JSON.stringify(payload);
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
