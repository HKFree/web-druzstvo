import { defineMiddleware } from 'astro:middleware';
import { getSecret } from 'astro:env/server';
import { isEditorPath, validCredentials } from './lib/server/auth.mjs';

export const onRequest = defineMiddleware(async (context, next) => {
  const editor = isEditorPath(context.url.pathname);
  if (editor) {
    const password = getSecret('ADMIN_PASSWORD');
    if (!password) {
      return new Response('Správce musí nejprve nastavit ADMIN_PASSWORD. Viz README.md.', {
        status: 503, headers: { 'Cache-Control': 'no-store' },
      });
    }
    if (!validCredentials(context.request.headers.get('authorization'), getSecret('ADMIN_USERNAME') ?? 'redakce', password)) {
      return new Response('Pro vstup do redakce se přihlaste.', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="hkfree redakce", charset="UTF-8"', 'Cache-Control': 'no-store' },
      });
    }
    if (!['GET', 'HEAD'].includes(context.request.method)
      && context.request.headers.get('origin') !== context.url.origin) {
      return new Response('Nepovolený původ požadavku.', { status: 403 });
    }
  }
  const response = await next();
  // Public pages read current server files; neither editor nor HTML can be stale in a cache.
  if (editor || response.headers.get('content-type')?.includes('text/html')) {
    response.headers.set('Cache-Control', 'no-store');
  }
  if (editor) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
});
