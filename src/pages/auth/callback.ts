import type { APIRoute } from 'astro';
import { authConfig } from '../../lib/server/auth-config';
import { finishLogin, cookieOptions, logins, SESSION_COOKIE, SESSION_SECONDS, TRANSACTION_COOKIE } from '../../lib/server/oidc.mjs';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const token = cookies.get(TRANSACTION_COOKIE)?.value;
  cookies.delete(TRANSACTION_COOKIE, { path: '/', secure: true });
  try {
    const config = authConfig();
    if (config.mode !== 'oidc') return redirect('/auth/error', 302);
    const result = await finishLogin(config, url, token);
    if (result.denied || !result.session) return redirect('/auth/error?reason=denied', 302);
    logins.revoke(cookies.get(SESSION_COOKIE)?.value);
    cookies.set(SESSION_COOKIE, result.session, { ...cookieOptions, maxAge: SESSION_SECONDS });
    return redirect(result.returnTo ?? '/keystatic', 302);
  } catch (error) {
    console.warn('OIDC callback failed:', error instanceof Error ? error.message : 'unknown');
    return redirect('/auth/error', 302);
  }
};
