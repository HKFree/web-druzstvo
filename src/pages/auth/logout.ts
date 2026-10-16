import { sitePath } from '../../lib/paths';
import type { APIRoute } from 'astro';
import { logins, SESSION_COOKIE, TRANSACTION_COOKIE } from '../../lib/server/oidc.mjs';

export const POST: APIRoute = ({ request, url, cookies, redirect }) => {
  if (request.headers.get('origin') !== url.origin) return new Response('Nepovolený požadavek.', { status: 403 });
  logins.revoke(cookies.get(SESSION_COOKIE)?.value);
  cookies.delete(SESSION_COOKIE, { path: '/', secure: true });
  cookies.delete(TRANSACTION_COOKIE, { path: '/', secure: true });
  return redirect(sitePath('/auth/signed-out'), 303);
};
