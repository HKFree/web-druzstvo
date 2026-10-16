import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { normalizeBasePath, prefixPath, stripBasePath } from '../src/lib/base-path.mjs';
import { transformKeystaticPaths } from '../integrations/keystatic-base.mjs';
import { readAuthConfig, safeReturnTo } from '../src/lib/server/oidc.mjs';
import { parseContactPage } from '../src/lib/server/contacts.mjs';

test('deployment prefixes validate, normalize and preserve external or already prefixed URLs', () => {
  for (const value of ['', '/']) assert.equal(normalizeBasePath(value), '');
  assert.equal(normalizeBasePath('/test/v2/'), '/test/v2');
  for (const value of ['v2', '//evil', '/a/../b', '/a%2fb', '/a?b', '/a#b', '/a\\b']) assert.throws(() => normalizeBasePath(value));
  for (const base of ['', '/v2']) {
    assert.equal(prefixPath('/kontakt/', base), base + '/kontakt/');
    assert.equal(stripBasePath(base + '/api/keystatic/update', base), '/api/keystatic/update');
    for (const value of ['https://example.org/', '//example.org/', '#kontakt', 'mailto:test@example.org', 'tel:+420123']) assert.equal(prefixPath(value, base), value);
  }
  assert.equal(prefixPath('/v2/novinky/', '/v2'), '/v2/novinky/');
  assert.equal(stripBasePath('/v20/keystatic', '/v2'), undefined);
});

test('OIDC redirects and return paths stay inside the deployment prefix', () => {
  const config = readAuthConfig({ AUTH_ORIGIN: 'https://web.example', OIDC_ISSUER: 'https://login.example/realm', OIDC_CLIENT_ID: 'test', OIDC_CLIENT_SECRET: 'test', OIDC_ALLOW_ALL_AUTHENTICATED: 'true' }, false, '/v2');
  assert.equal(config.redirectUri, 'https://web.example/v2/auth/callback');
  assert.equal(safeReturnTo('/v2/keystatic/collection/novinky?view=all', '/v2'), '/v2/keystatic/collection/novinky?view=all');
  for (const path of ['/keystatic', '/v20/keystatic', '//evil/keystatic', '/v2/keystatic/../../evil', '/v2/keystatic/%2e%2e']) assert.equal(safeReturnTo(path, '/v2'), '/v2/keystatic');
});

test('stored editorial links and images adapt to prefix without modifying content', () => {
  const source = '---\ntitle: Kontakty\ndescription: Úvod\n---\n\n[Dokument](/dokumenty/cenik.pdf)\n\n![Obrázek](/images/novinky/test.png)\n\n[Wiki](https://wiki.hkfree.org)\n';
  const page = parseContactPage(source, '/v2');
  assert.match(page.html, /href="\/v2\/dokumenty\/cenik.pdf"/);
  assert.match(page.html, /src="\/v2\/images\/novinky\/test.png"/);
  assert.match(page.html, /href="https:\/\/wiki.hkfree.org"/);
  assert.doesNotMatch(parseContactPage(source).html, /\/v2\//);
});

test('installed Keystatic client router and API requests support the deployment prefix', async () => {
  const directory = 'node_modules/@keystatic/core/dist';
  const modules = await Promise.all((await readdir(directory)).filter(file => file.endsWith('.js')).map(file => readFile(`${directory}/${file}`, 'utf8')));
  const source = modules.find(code => code.includes('function RouterProvider('));
  assert.ok(source, 'Keystatic router module must be covered by the prefix integration');
  const result = transformKeystaticPaths(source, '/v2');
  assert.ok(result.includes(String.raw`/^\/v2\/keystatic\/?/`));
  assert.ok(result.includes("fetch('/v2/api/keystatic/tree'"));
  assert.ok(result.includes('startsWith("/v2/keystatic")'));
  assert.ok(result.includes('https://github.com/Thinkmill/keystatic/'));
  assert.equal(transformKeystaticPaths(source, ''), source);
  assert.throws(() => transformKeystaticPaths('function RouterProvider() { /* changed upstream */ }', '/v2'));
});
