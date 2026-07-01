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

        const { data, error } = await admin.rpc('generate_nudges_all_users')
        if (error) {
          console.error('generate_nudges_all_users failed', error)
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ ok: true, result: data }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
