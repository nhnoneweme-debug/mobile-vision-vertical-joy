import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

export const Route = createFileRoute('/api/public/hooks/push-notification')({
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

        let body: { notification_id?: string } = {}
        try {
          body = await request.json()
        } catch {
          return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 })
        }
        const id = body?.notification_id
        if (!id || typeof id !== 'string') {
          return new Response(JSON.stringify({ error: 'missing_notification_id' }), { status: 400 })
        }

        const url = process.env.SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!url || !serviceKey) {
          return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 })
        }

        const admin = createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })

        const { data: n, error } = await admin
          .from('notifications')
          .select('id, user_id, title, body, link, kind, pushed_at, read_at')
          .eq('id', id)
          .maybeSingle()

        if (error) {
          console.error('load notification failed', error)
          return new Response(JSON.stringify({ error: error.message }), { status: 500 })
        }
        if (!n) return new Response(JSON.stringify({ ok: false, reason: 'not_found' }), { status: 404 })
        if (n.pushed_at || n.read_at) {
          return new Response(JSON.stringify({ ok: true, skipped: true }))
        }

        try {
          const { sendPushToUser } = await import('@/lib/push.server')
          const r = await sendPushToUser(n.user_id, {
            title: n.title,
            body: n.body ?? '',
            url: n.link ?? '/notificacoes',
            tag: n.kind ?? undefined,
                  kind: n.kind ?? undefined,
          })
          await admin
            .from('notifications')
            .update({ pushed_at: new Date().toISOString() })
            .eq('id', n.id)
          return new Response(JSON.stringify({ ok: true, sent: r.sent, removed: r.removed, errors: r.errors }))
        } catch (e) {
          console.error('push send failed', e)
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'unknown' }),
            { status: 500 },
          )
        }
      },
    },
  },
})
