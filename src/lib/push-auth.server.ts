/**
 * Shared-secret guard for the internal push webhooks that pg_cron / DB triggers call.
 * Returns a Response when the caller is not authorized, otherwise null.
 */
export function verifyPushSecret(request: Request): Response | null {
  const accepted = [process.env['PUSH_WEBHOOK_SECRET'], process.env['CRON_PUSH_SECRET']].filter(
    (v): v is string => !!v && v.length > 0,
  );
  if (accepted.length === 0) return new Response('Forbidden', { status: 403 });

  const provided =
    request.headers.get('x-push-secret') ??
    (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!provided || !accepted.includes(provided)) return new Response('Forbidden', { status: 403 });
  return null;
}
