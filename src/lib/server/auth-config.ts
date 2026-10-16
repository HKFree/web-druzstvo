import { getSecret } from 'astro:env/server';
import { readAuthConfig } from './oidc.mjs';

const keys = [
  'AUTH_MODE', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'AUTH_ORIGIN', 'OIDC_ISSUER',
  'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'OIDC_CLIENT_AUTH_METHOD',
  'OIDC_ALLOWED_SUBJECTS', 'OIDC_ALLOWED_EMAILS', 'OIDC_ALLOW_ALL_AUTHENTICATED',
];
export function authConfig() {
  return readAuthConfig(Object.fromEntries(keys.map(key => [key, getSecret(key)])), import.meta.env.DEV);
}
