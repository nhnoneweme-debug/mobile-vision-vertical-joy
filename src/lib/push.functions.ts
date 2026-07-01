import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const sendTestPush = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { sendPushToUser } = await import('./push.server');
    const result = await sendPushToUser(userId, {
      title: '🔥 Push ativado',
      body: 'Sua brasa vai avisar quando algo importante acontecer.',
      url: '/notificacoes',
      tag: 'push-test',
    });
    return result;
  });
