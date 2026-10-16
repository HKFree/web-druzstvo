import { sitePath } from '../../lib/paths';
import type { APIRoute } from 'astro';
import { authConfig } from '../../lib/server/auth-config';
import { beginLogin, cookieOptions, logins, SESSION_COOKIE, TRANSACTION_COOKIE, TRANSACTION_SECONDS } from '../../lib/server/oidc.mjs';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  try {
    const config = authConfig();
    if (config.mode === 'password') return redirect(sitePath('/keystatic'), 302);
    if (logins.get(cookies.get(SESSION_COOKIE)?.value, config)) return redirect(sitePath('/keystatic'), 302);
    const { url: authorizationUrl, transaction } = await beginLogin(config, url.searchParams.get('returnTo'));
    cookies.set(TRANSACTION_COOKIE, transaction, { ...cookieOptions, maxAge: TRANSACTION_SECONDS });
    return redirect(authorizationUrl.toString(), 302);
  } catch {
    return redirect(sitePath('/auth/error?reason=configuration'), 302);
  }
};
