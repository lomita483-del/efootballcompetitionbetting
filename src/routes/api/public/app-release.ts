import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

export const Route = createFileRoute('/api/public/app-release')({
  server: {
    handlers: {
      GET: async () => {
        const { data, error } = await supabaseAdmin
          .from('app_release_control')
          .select('enabled,latest_version,latest_build,download_url,whats_new,force_update,minimum_supported_build,updated_at')
          .eq('id', 1)
          .maybeSingle()

        if (error) {
          return new Response(JSON.stringify({ error: 'release_unavailable' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          })
        }

        if (!data?.enabled) {
          return new Response(JSON.stringify({ enabled: false }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' },
          })
        }

        const notes = Array.isArray(data.whats_new) ? data.whats_new.filter((x: unknown) => typeof x === 'string' && x.trim()) : []

        return new Response(JSON.stringify({
          enabled: true,
          app: 'E-Football Competition Bet',
          platform: 'android',
          latestVersion: data.latest_version,
          latestBuild: Number(data.latest_build),
          minimumSupportedBuild: Number(data.minimum_supported_build || 0),
          forceUpdate: !!data.force_update,
          downloadUrl: data.download_url,
          whatsNew: notes,
          releaseNotes: notes,
          publishedAt: data.updated_at,
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0',
            'CDN-Cache-Control': 'no-store',
          },
        })
      },
    },
  },
})
