import { defineMiddleware } from 'astro:middleware';
import { isEditorPath, validCredentials } from './lib/server/auth.mjs';
import { authConfig } from './lib/server/auth-config';
import { logins, SESSION_COOKIE } from './lib/server/oidc.mjs';

export const onRequest = defineMiddleware(async (context, next) => {
  const editor = isEditorPath(context.url.pathname);
  const authRoute = context.url.pathname.startsWith('/auth/');
  if (editor) {
    let config;
    try { config = authConfig(); }
    catch {
      return new Response('Přihlášení není nastavené. Správce najde potřebné nastavení v README.', {
        status: 503, headers: { 'Cache-Control': 'no-store' },
      });
    }
    if (config.mode === 'password') {
      if (!validCredentials(context.request.headers.get('authorization'), config.username, config.password)) {
        return new Response('Pro vstup do vývojové redakce se přihlaste.', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="hkfree vyvoj", charset="UTF-8"', 'Cache-Control': 'no-store' },
        });
      }
    } else if (!logins.get(context.cookies.get(SESSION_COOKIE)?.value, config)) {
      if (decodeURIComponent(context.url.pathname).startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'Přihlášení vypršelo. Znovu otevřete administraci.' }), {
          status: 401, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }
      const target = new URLSearchParams({ returnTo: context.url.pathname + context.url.search });
      return context.redirect(`/auth/login?${target}`, 302);
    }
    if (!['GET', 'HEAD'].includes(context.request.method)
      && context.request.headers.get('origin') !== context.url.origin) {
      return new Response('Nepovolený původ požadavku.', { status: 403 });
    }
  }
  const response = await next();
  if (editor || authRoute || response.headers.get('content-type')?.includes('text/html')) {
    response.headers.set('Cache-Control', 'no-store');
  }
  if (editor || authRoute) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    // Native same-origin POST forms need an Origin header (no-referrer makes it null).
    response.headers.set('Referrer-Policy', editor ? 'same-origin' : 'no-referrer');
  }
  return response;
});
