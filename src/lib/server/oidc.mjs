import { randomBytes } from 'node:crypto';
import * as oidc from 'openid-client';

export const SESSION_COOKIE = '__Host-hkfree_session';
export const TRANSACTION_COOKIE = '__Host-hkfree_oidc';
export const SESSION_SECONDS = 8 * 60 * 60;
export const TRANSACTION_SECONDS = 5 * 60;
/** @type {{path: string, httpOnly: boolean, secure: boolean, sameSite: 'lax'}} */
export const cookieOptions = { path: '/', httpOnly: true, secure: true, sameSite: 'lax' };
const list = value => (value ?? '').split(',').map(item => item.trim()).filter(Boolean);

export function readAuthConfig(env, development = false) {
  const mode = env.AUTH_MODE || (development ? 'password' : 'oidc');
  if (mode === 'password') {
    if (!development) throw new Error('Přihlášení heslem je povolené pouze ve vývojovém serveru.');
    if (!env.ADMIN_PASSWORD) throw new Error('Pro vývoj nastavte ADMIN_PASSWORD.');
    return { mode, username: env.ADMIN_USERNAME || 'redakce', password: env.ADMIN_PASSWORD };
  }
  if (mode !== 'oidc') throw new Error('AUTH_MODE musí být password nebo oidc.');
  const required = ['AUTH_ORIGIN', 'OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET'];
  if (required.some(key => !env[key])) throw new Error('Správce musí nastavit OIDC přihlášení podle README.');
  const origin = new URL(env.AUTH_ORIGIN);
  const issuer = new URL(env.OIDC_ISSUER);
  if (origin.protocol !== 'https:' || issuer.protocol !== 'https:'
    || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
    || issuer.username || issuer.password || issuer.search || issuer.hash) {
    throw new Error('AUTH_ORIGIN a OIDC_ISSUER musí být platné HTTPS adresy. AUTH_ORIGIN obsahuje pouze původ webu.');
  }
  const subjects = list(env.OIDC_ALLOWED_SUBJECTS);
  const emails = list(env.OIDC_ALLOWED_EMAILS).map(email => email.toLowerCase());
  const allowAllAuthenticated = env.OIDC_ALLOW_ALL_AUTHENTICATED === 'true';
  if (!allowAllAuthenticated && !subjects.length && !emails.length) throw new Error('Povolte přístup řízený OIDC nebo nastavte povolené redaktory podle README.');
  const clientAuthMethod = env.OIDC_CLIENT_AUTH_METHOD || 'client_secret_basic';
  if (!['client_secret_basic', 'client_secret_post'].includes(clientAuthMethod)) throw new Error('Neplatná metoda ověření OIDC klienta.');
  return {
    mode, origin: origin.origin, issuer: issuer.href, clientId: env.OIDC_CLIENT_ID,
    clientSecret: env.OIDC_CLIENT_SECRET, clientAuthMethod, subjects, emails, allowAllAuthenticated,
    redirectUri: `${origin.origin}/auth/callback`,
  };
}

export function authorizedIdentity(claims, config) {
  return typeof claims?.sub === 'string' && claims.sub.length > 0 && (config.allowAllAuthenticated === true || config.subjects.includes(claims.sub)
    || (claims.email_verified === true && typeof claims.email === 'string'
      && config.emails.includes(claims.email.toLowerCase())));
}

export function safeReturnTo(value) {
  if (typeof value !== 'string' || value.includes('\\') || value.includes('%') || value.includes('#')) return '/keystatic';
  try {
    const url = new URL(value, 'https://internal.invalid');
    if (url.origin === 'https://internal.invalid' && (url.pathname === '/keystatic' || url.pathname.startsWith('/keystatic/'))) return url.pathname + url.search;
  } catch {}
  return '/keystatic';
}

// Only opaque random tokens reach the browser. Provider tokens stay on the server
// and are discarded after login. Restarting this process expires all logins.
export function createLoginStore(now = () => Date.now()) {
  const pending = new Map();
  const sessions = new Map();
  const prune = map => { for (const [key, value] of map) if (value.expires <= now()) map.delete(key); };
  function put(map, value, seconds, maximum) {
    prune(map);
    if (map.size >= maximum) throw new Error('Příliš mnoho přihlášení. Zkuste to později.');
    const token = randomBytes(32).toString('base64url');
    map.set(token, { ...value, expires: now() + seconds * 1000 });
    return token;
  }
  return {
    transaction: value => put(pending, value, TRANSACTION_SECONDS, 256),
    consume(token) {
      const value = pending.get(token);
      pending.delete(token);
      return value && value.expires > now() ? value : undefined;
    },
    session: value => put(sessions, value, SESSION_SECONDS, 2048),
    get(token, config) {
      prune(sessions);
      const value = sessions.get(token);
      return value && value.issuer === config.issuer && authorizedIdentity(value.claims, config) ? value : undefined;
    },
    revoke(token) { sessions.delete(token); },
  };
}

export const logins = createLoginStore();
let discovered;
let discoveryKey;
async function client(config) {
  const key = JSON.stringify([config.issuer, config.clientId, config.clientSecret, config.clientAuthMethod]);
  if (!discovered || discoveryKey !== key) {
    discoveryKey = key;
    discovered = oidc.discovery(new URL(config.issuer), config.clientId, { redirect_uris: [config.redirectUri] },
      config.clientAuthMethod === 'client_secret_basic' ? oidc.ClientSecretBasic(config.clientSecret) : oidc.ClientSecretPost(config.clientSecret),
      { timeout: 10, execute: [oidc.enableNonRepudiationChecks] },
    ).catch(error => { discovered = undefined; throw error; });
  }
  return discovered;
}

export async function beginLogin(config, returnTo) {
  const configuration = await client(config);
  const verifier = oidc.randomPKCECodeVerifier();
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const challenge = await oidc.calculatePKCECodeChallenge(verifier);
  const url = oidc.buildAuthorizationUrl(configuration, {
    redirect_uri: config.redirectUri, response_type: 'code', scope: 'openid email profile',
    state, nonce, code_challenge: challenge, code_challenge_method: 'S256',
  });
  const transaction = logins.transaction({ verifier, state, nonce, returnTo: safeReturnTo(returnTo), issuer: config.issuer });
  return { url, transaction };
}

export async function finishLogin(config, url, transactionToken) {
  const transaction = logins.consume(transactionToken);
  if (!transaction || transaction.issuer !== config.issuer || url.origin !== config.origin || url.pathname !== '/auth/callback') {
    throw new Error('Přihlašovací požadavek vypršel nebo není platný.');
  }
  const configuration = await client(config);
  const tokens = await oidc.authorizationCodeGrant(configuration, url, {
    pkceCodeVerifier: transaction.verifier, expectedState: transaction.state,
    expectedNonce: transaction.nonce, idTokenExpected: true,
  });
  const claims = tokens.claims();
  if (!authorizedIdentity(claims, config)) return { denied: true };
  const session = logins.session({ issuer: config.issuer,
    claims: { sub: claims.sub, email: claims.email, email_verified: claims.email_verified },
  });
  return { session, returnTo: transaction.returnTo };
}
