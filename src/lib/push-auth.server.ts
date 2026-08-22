/**
 * Shared-secret guard for the internal push webhooks that pg_cron / DB triggers call.
 * Returns a Response when the caller is not authorized, otherwise null.
 */
export function verifyPushSecret(request: Request): Response | null {
  const expected = process.env['PUSH_WEBHOOK_SECRET'];
  if (!expected) return new Response('Forbidden', { status: 403 });
  const provided =
    request.headers.get('x-push-secret') ??
    (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!provided || provided !== expected) return new Response('Forbidden', { status: 403 });
  return null;
}
