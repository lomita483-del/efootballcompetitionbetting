import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

function parseUserAgent(ua: string) {
  let os = 'Unknown'
  if (/windows/i.test(ua)) os = 'Windows'
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS'
  else if (/android/i.test(ua)) os = 'Android'
  else if (/mac os x/i.test(ua)) os = 'macOS'
  else if (/linux/i.test(ua)) os = 'Linux'

  let browser = 'Unknown'
  if (/edg\//i.test(ua)) browser = 'Edge'
  else if (/crios/i.test(ua)) browser = 'Chrome (iOS)'
  else if (/chrome\//i.test(ua)) browser = 'Chrome'
  else if (/fxios/i.test(ua)) browser = 'Firefox (iOS)'
  else if (/firefox\//i.test(ua)) browser = 'Firefox'
  else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari'

  const device_type = /mobile|iphone|android.*mobile/i.test(ua)
    ? 'Mobile'
    : /ipad|tablet/i.test(ua)
    ? 'Tablet'
    : 'Desktop'

  return { os, browser, device_type }
}

// Server-side session heartbeat, called on a timer from AuthContext.tsx.
// Runs server-side so we can capture the real client IP from request headers
// (browser JS can never see its own public IP), and verifies the caller's
// identity from their auth token rather than trusting a client-supplied
// user_id, since this data feeds fraud / multi-account detection.
export const Route = createFileRoute('/api/public/hooks/log-session')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get('authorization') || ''
          const token = authHeader.replace(/^Bearer\s+/i, '')
          if (!token) return new Response('unauthorized', { status: 401 })

          const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
          if (userErr || !userData?.user) return new Response('unauthorized', { status: 401 })
          const user_id = userData.user.id

          const { route } = (await request.json().catch(() => ({}))) as { route?: string }

          const ip =
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            null
          const ua = request.headers.get('user-agent') || ''
          const { os, browser, device_type } = parseUserAgent(ua)

          await supabaseAdmin.from('user_sessions').upsert(
            {
              user_id,
              last_seen: new Date().toISOString(),
              route: route?.slice(0, 255) || null,
              user_agent: ua.slice(0, 255),
              ip_address: ip,
              device_type,
              browser,
              os,
            },
            { onConflict: 'user_id' }
          )

          return new Response('ok', { status: 200 })
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e?.message || 'error' }), { status: 500 })
        }
      },
    },
  },
})
