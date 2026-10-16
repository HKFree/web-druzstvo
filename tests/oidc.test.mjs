import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAuthConfig, safeReturnTo, authorizedIdentity, createLoginStore } from '../src/lib/server/oidc.mjs';

const env = {
  AUTH_ORIGIN: 'https://web.example', OIDC_ISSUER: 'https://login.example/realm',
  OIDC_CLIENT_ID: 'web', OIDC_CLIENT_SECRET: 'test-only', OIDC_ALLOWED_SUBJECTS: 'editor-1, editor-2',
};

test('development defaults to password; production defaults to OIDC and never falls back to password', () => {
  assert.equal(readAuthConfig({ ADMIN_PASSWORD: 'local' }, true).mode, 'password');
  assert.equal(readAuthConfig(env, false).mode, 'oidc');
  assert.throws(() => readAuthConfig({ ADMIN_PASSWORD: 'local' }, false));
  assert.throws(() => readAuthConfig({ ...env, AUTH_MODE: 'password', ADMIN_PASSWORD: 'local' }, false));
  assert.equal(readAuthConfig({ ...env, AUTH_MODE: 'oidc' }, true).mode, 'oidc');
  assert.throws(() => readAuthConfig({}, true));
  assert.throws(() => readAuthConfig({ ...env, AUTH_MODE: 'invalid' }, true));
});

test('OIDC configuration requires HTTPS origins, credentials and an explicit editor allowlist', () => {
  assert.equal(readAuthConfig(env).redirectUri, 'https://web.example/auth/callback');
  for (const replacement of [
    { AUTH_ORIGIN: 'http://web.example' }, { AUTH_ORIGIN: 'https://web.example/extra' },
    { AUTH_ORIGIN: 'https://user:pass@web.example' }, { OIDC_ISSUER: 'http://login.example' },
    { OIDC_CLIENT_SECRET: '' }, { OIDC_ALLOWED_SUBJECTS: '' }, { OIDC_CLIENT_AUTH_METHOD: 'invalid' },
  ]) assert.throws(() => readAuthConfig({ ...env, ...replacement }));
});

test('editor authorization accepts allowed subjects or explicitly verified allowed emails', () => {
  const config = readAuthConfig({ ...env, OIDC_ALLOWED_EMAILS: 'Editor@hkfree.org' });
  assert.equal(authorizedIdentity({ sub: 'editor-1' }, config), true);
  assert.equal(authorizedIdentity({ sub: 'outsider' }, config), false);
  assert.equal(authorizedIdentity({ sub: 'user', email: 'editor@hkfree.org', email_verified: true }, config), true);
  assert.equal(authorizedIdentity({ sub: 'user', email: 'editor@hkfree.org', email_verified: false }, config), false);
  assert.equal(authorizedIdentity({ sub: 'user', email: 'editor@hkfree.org' }, config), false);
  assert.equal(authorizedIdentity({ email: 'editor@hkfree.org', email_verified: true }, config), false);
});

test('login state is single-use, expires, and sessions can be revoked or removed from the allowlist', () => {
  let now = 0;
  const store = createLoginStore(() => now);
  const state = store.transaction({ nonce: 'expected' });
  assert.equal(store.consume(state).nonce, 'expected');
  assert.equal(store.consume(state), undefined);
  const expired = store.transaction({ nonce: 'expired' });
  now += 301_000;
  assert.equal(store.consume(expired), undefined);
  const config = readAuthConfig(env);
  const token = store.session({ issuer: config.issuer, claims: { sub: 'editor-1' } });
  assert.ok(store.get(token, config));
  assert.equal(store.get(token, { ...config, issuer: 'https://other.example/' }), undefined);
  assert.equal(store.get(token, { ...config, subjects: [] }), undefined);
  store.revoke(token);
  assert.equal(store.get(token, config), undefined);
  const session = store.session({ issuer: config.issuer, claims: { sub: 'editor-1' } });
  now += 8 * 3600_000;
  assert.equal(store.get(session, config), undefined);
});

test('return paths stay inside the editor and never redirect to another site', () => {
  assert.equal(safeReturnTo('/keystatic/collection/novinky?view=all'), '/keystatic/collection/novinky?view=all');
  for (const value of ['https://evil.example', '//evil.example/keystatic', '/api/keystatic/update', '/keystatic-other', '/keystatic/%2e%2e', '/keystatic/../../evil', '/keystatic/\\evil', null]) {
    assert.equal(safeReturnTo(value), '/keystatic');
  }
});
