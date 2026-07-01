import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

export const Route = createFileRoute('/api/public/hooks/generate-nudges')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get('apikey') ?? request.headers.get('x-api-key')
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const url = process.env.SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!url || !serviceKey) {
          return new Response(JSON.stringify({ error: 'server_misconfigured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const admin = createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })

        const { data: genResult, error: genErr } = await admin.rpc('generate_nudges_all_users')
        if (genErr) {
          console.error('generate_nudges_all_users failed', genErr)
          return new Response(JSON.stringify({ ok: false, error: genErr.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Flush push notifications for anything still unsent
        let pushSent = 0
        let pushErrors = 0
        try {
          const { data: pending, error: pendingErr } = await admin
            .from('notifications')
            .select('id, user_id, title, body, link, kind')
            .is('pushed_at', null)
            .is('read_at', null)
            .order('created_at', { ascending: true })
            .limit(500)

          if (pendingErr) throw pendingErr

          if (pending && pending.length > 0) {
            const { sendPushToUser } = await import('@/lib/push.server')
            const now = new Date().toISOString()
            for (const n of pending) {
              try {
                const r = await sendPushToUser(n.user_id, {
                  title: n.title,
                  body: n.body ?? '',
                  url: n.link ?? '/notificacoes',
                  tag: n.kind ?? undefined,
                })
                pushSent += r.sent
                pushErrors += r.errors
              } catch (e) {
                console.error('push flush failed', n.id, e)
                pushErrors++
              }
              await admin
                .from('notifications')
                .update({ pushed_at: now })
                .eq('id', n.id)
            }
          }
        } catch (e) {
          console.error('push flush block failed', e)
        }

        return new Response(
          JSON.stringify({ ok: true, result: genResult, push: { sent: pushSent, errors: pushErrors } }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  },
})
