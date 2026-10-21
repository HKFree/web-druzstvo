import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { createProvider, cookieClient } from './helpers/oidc-provider.mjs';
import { normalizeBasePath } from '../src/lib/base-path.mjs';
import { SESSION_COOKIE, TRANSACTION_COOKIE } from '../src/lib/server/oidc.mjs';

test('production OIDC authentication, authorization and live editing', { timeout: 60_000 }, async () => {
  const work = await mkdtemp(join(tmpdir(), 'hkfree-production-'));
  const socket = createServer();
  await new Promise(done => socket.listen(0, '127.0.0.1', done));
  const port = socket.address().port;
  await new Promise(done => socket.close(done));
  const origin = `https://127.0.0.1:${port}`;
  const prefix = normalizeBasePath(process.env.TEST_BASE_PATH);
  const route = path => prefix + path;
  const base = origin + prefix;
  const provider = await createProvider(work);
  const anonymous = provider.fetchLocal;
  const entrypoint = resolve('dist/server/entry.mjs');
  let server;
  let logs = '';
  async function start(overrides = {}) {
    server = spawn(process.execPath, [entrypoint], {
      cwd: work,
      env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
        CONTENT_DIR: join(work, 'content'), ADMIN_USERNAME: 'test', ADMIN_PASSWORD: 'must-never-work-in-production',
        NODE_EXTRA_CA_CERTS: provider.certPath, SERVER_CERT_PATH: provider.certPath, SERVER_KEY_PATH: provider.keyPath,
        AUTH_MODE: 'oidc', AUTH_ORIGIN: origin, OIDC_ISSUER: provider.issuer, OIDC_CLIENT_ID: 'test-web',
        OIDC_CLIENT_SECRET: 'test-secret', OIDC_ALLOWED_SUBJECTS: 'editor-1', OIDC_ALLOWED_EMAILS: '', OIDC_ALLOW_ALL_AUTHENTICATED: 'false',
        ...overrides },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', chunk => { logs += chunk; });
    server.stderr.on('data', chunk => { logs += chunk; });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(logs);
      try { if ((await anonymous(base)).ok) return; } catch {}
      await new Promise(done => setTimeout(done, 50));
    }
    throw new Error(`Server did not start: ${logs}`);
  }
  async function stop() {
    if (server && server.exitCode === null) {
      server.kill();
      await new Promise(done => server.once('exit', done));
    }
  }
  async function login(flags = {}, tamperState = false, callbackHeaders = {}) {
    const browser = cookieClient(provider.fetchLocal);
    const start = await browser.request(base + '/auth/login?' + new URLSearchParams({ returnTo: route('/keystatic/collection/novinky') }));
    assert.equal(start.status, 302);
    const transactionCookie = start.headers.getSetCookie().find(value => value.startsWith(TRANSACTION_COOKIE + '='));
    assert.match(transactionCookie, /Secure/);
    assert.match(transactionCookie, /HttpOnly/);
    assert.match(transactionCookie, /SameSite=Lax/i);
    const authorize = new URL(start.headers.get('location'));
    assert.equal(authorize.origin, provider.issuer);
    assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(authorize.searchParams.get('redirect_uri'), base + '/auth/callback');
    assert.ok(authorize.searchParams.get('nonce'));
    for (const [key, value] of Object.entries(flags)) authorize.searchParams.set(key, value);
    const issued = await browser.request(authorize);
    assert.equal(issued.status, 302);
    const callback = new URL(issued.headers.get('location'));
    if (tamperState) callback.searchParams.set('state', 'wrong-state');
    const response = await browser.request(callback, { headers: callbackHeaders });
    return { browser, response, callback };
  }
  const source = draft => `---\ntitle: Živá novinka\npublishedAt: 2026-01-01\ncategory: sit\nexcerpt: Úprava bez sestavení\ndraft: ${draft}\n---\n\nText novinky.\n\n![Test](/images/novinky/live/test.png)\n`;
  const addition = (path, contents) => ({ path, contents: Buffer.from(contents).toString('base64url') });
  let editor;
  const update = (data, requestOrigin = origin) => editor.request(base + '/api/keystatic/update', {
    method: 'POST', headers: { origin: requestOrigin, 'content-type': 'application/json', 'no-cors': '1' }, body: JSON.stringify(data),
  });
  try {
    await start();
    const homepage = await (await anonymous(base + '/')).text();
    for (const path of ['/kontakt/', '/novinky/', '/images/hkfree-logo-druzstvo.png', '/favicon.ico']) {
      assert.ok(homepage.includes(`"${route(path)}"`), path);
    }
    const admin = await anonymous(base + '/admin');
    assert.equal(admin.status, 302);
    assert.equal(admin.headers.get('location'), route('/keystatic'));
    if (prefix) {
      for (const path of ['/api/keystatic/tree', '/keystatic', '/kontakt/']) {
        assert.equal((await anonymous(origin + path, { headers: { 'no-cors': '1' } })).status, 404, path);
      }
    }
    for (const path of ['/keystatic', '/%6beystatic/collection/novinky']) {
      const response = await anonymous(base + path);
      assert.equal(response.status, 302);
      assert.ok(response.headers.get('location').startsWith(route('/auth/login?')));
    }
    for (const path of ['/api/keystatic/tree', '/api/%6beystatic/tree', '/api%2Fkeystatic/tree']) {
      assert.equal((await anonymous(base + path)).status, 401, path);
    }
    const basic = 'Basic ' + Buffer.from('test:must-never-work-in-production').toString('base64');
    assert.equal((await anonymous(base + '/api/keystatic/tree', { headers: { authorization: basic } })).status, 401);
    const allowed = await login();
    assert.equal(allowed.response.status, 302);
    assert.equal(allowed.response.headers.get('location'), route('/keystatic/collection/novinky'), logs);
    assert.ok(allowed.browser.cookies.get(SESSION_COOKIE));
    assert.equal(allowed.browser.cookies.has(TRANSACTION_COOKIE), false);
    const editorPage = await allowed.browser.request(base + '/keystatic');
    assert.equal(editorPage.status, 200);
    assert.equal(editorPage.headers.get('referrer-policy'), 'same-origin');
    assert.equal(allowed.response.headers.get('referrer-policy'), 'no-referrer');
    const replay = await allowed.browser.request(allowed.callback);
    assert.equal(replay.headers.get('location'), route('/auth/error'));
    editor = allowed.browser;
    const wrongProxyProtocol = await login({}, false, { 'x-forwarded-proto': 'http' });
    assert.equal(wrongProxyProtocol.response.headers.get('location'), route('/auth/error'));
    assert.equal(wrongProxyProtocol.browser.cookies.has(SESSION_COOKIE), false);
    assert.match(logs, /\[oidc_origin_mismatch\]/);
    assert.ok(!logs.includes(wrongProxyProtocol.callback.searchParams.get('code')));
    assert.ok(!logs.includes(wrongProxyProtocol.callback.searchParams.get('state')));
    assert.match(await (await anonymous(base + '/kontakt/')).text(), /Nay-Tech/);
    const contactSource = '---\ntitle: Živé kontakty\ndescription: Upravený úvod\n---\n\n## Technická podpora\n\n[Telefon](tel:+420608101070)\n';
    const contactUpdate = await update({ additions: [addition('content/stranky/kontakt.mdoc', contactSource)], deletions: [] });
    assert.equal(contactUpdate.status, 200, await contactUpdate.text());
    const contactPage = await anonymous(base + '/kontakt/');
    assert.equal(contactPage.headers.get('cache-control'), 'no-store');
    assert.match(await contactPage.text(), /<h1>Živé kontakty<\/h1>/);

    for (const [flags, tamper] of [
      [{ test_subject: 'outsider' }, false], [{ test_nonce: 'wrong' }, false],
      [{ test_signature: 'bad' }, false], [{ test_expired: 'yes' }, false], [{}, true],
    ]) {
      const denied = await login(flags, tamper);
      assert.ok(denied.response.headers.get('location').startsWith(route('/auth/error')));
      assert.equal(denied.browser.cookies.has(SESSION_COOKIE), false);
      assert.equal((await denied.browser.request(base + '/api/keystatic/tree')).status, 401);
    }

    const path = 'content/novinky/live.mdoc';
    let result = await update({ additions: [addition(path, source(true))], deletions: [] });
    assert.equal(result.status, 200, await result.text());
    assert.equal((await anonymous(base + '/novinky/live/')).status, 404);
    assert.doesNotMatch(await (await anonymous(base + '/novinky/')).text(), /Živá novinka/);
    result = await update({ additions: [addition(path, source(false)), addition('images/novinky/live/test.png', Buffer.from([137, 80, 78, 71]))], deletions: [] });
    assert.equal(result.status, 200, await result.text());
    const page = await anonymous(base + '/novinky/live/');
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('cache-control'), 'no-store');
    assert.match(await page.text(), /Úprava bez sestavení/);
    assert.match(await (await anonymous(base + '/novinky/')).text(), /Živá novinka/);
    assert.equal((await anonymous(base + '/images/novinky/live/test.png')).headers.get('content-type'), 'image/png');
    const facebookUrl = 'https://www.facebook.com/hkfree/posts/123';
    const facebookPath = 'content/novinky/facebook-test.mdoc';
    const facebookSource = draft => source(draft).replace('Živá novinka', 'Facebook novinka').replace('\n---\n\n', `\nbody:\n  discriminant: facebook\n  value:\n    facebookUrl: ${facebookUrl}\n---\n\n`);
    result = await update({ additions: [addition(facebookPath, facebookSource(true))], deletions: [] });
    assert.equal(result.status, 200, await result.text());
    assert.equal((await anonymous(base + '/novinky/facebook-test/')).status, 404);
    assert.doesNotMatch(await (await anonymous(base + '/novinky/')).text(), /Facebook novinka/);
    result = await update({ additions: [addition(facebookPath, facebookSource(false))], deletions: [] });
    assert.equal(result.status, 200, await result.text());
    for (const path of ['/', '/novinky/']) {
      const html = await (await anonymous(base + path)).text();
      assert.ok(html.includes(`href="${facebookUrl}"`));
      assert.match(html, /class="facebook-icon"/);
      assert.ok(!html.includes(`href="${route('/novinky/facebook-test/')}"`));
    }
    const facebookRedirect = await anonymous(base + '/novinky/facebook-test/');
    assert.equal(facebookRedirect.status, 302);
    assert.equal(facebookRedirect.headers.get('location'), facebookUrl);
    result = await update({ additions: [addition(facebookPath, facebookSource(false).replace(facebookUrl, 'https://facebook.com.evil.example/'))], deletions: [] });
    assert.equal(result.status, 400);
    assert.equal((await anonymous(base + '/novinky/facebook-test/')).headers.get('location'), facebookUrl);
    assert.equal((await update({ additions: [], deletions: [] }, 'https://cizi.example')).status, 403);
    // Verify that trusted HTTPS proxy headers preserve the public origin for CSRF checks.
    result = await editor.request(base + '/api/keystatic/update', { method: 'POST',
      headers: { origin: 'https://localhost', 'x-forwarded-host': 'localhost', 'x-forwarded-proto': 'https',
        'content-type': 'application/json', 'no-cors': '1' }, body: JSON.stringify({ additions: [], deletions: [] }) });
    assert.equal(result.status, 200);

    // Document PDFs use runtime storage and a stable public URL independent of their filename.
    const importedDocuments = JSON.parse(await (await import('node:fs/promises')).readFile(resolve('src/content/dokumenty/initial.json'), 'utf8'));
    const { createHash } = await import('node:crypto');
    for (const document of importedDocuments) {
      const response = await anonymous(base + `/dokumenty/${document.id}.pdf`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'application/pdf');
      assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), document.fileSha256 ?? document.sourceSha256);
    }
    const documentPath = 'content/dokumenty/test-document.yaml';
    const pdfPath = 'files/dokumenty/test-document/file.pdf';
    const documentUrl = base + '/dokumenty/test-document.pdf';
    const documentData = (draft, unlisted = false) => JSON.stringify({ title: 'Spravovaný dokument', order: 0, draft, unlisted, file: '/' + pdfPath });
    const originalPdf = '%PDF-1.4\nOriginal document\n%%EOF';
    result = await update({ additions: [addition(documentPath, documentData(true)), addition(pdfPath, originalPdf)], deletions: [] });
    assert.equal(result.status, 200, await result.text());
    assert.equal((await anonymous(documentUrl)).status, 404);
    assert.equal((await anonymous(base + '/' + pdfPath)).status, 404);
    result = await update({ additions: [addition(documentPath, documentData(false))], deletions: [] });
    assert.equal(result.status, 200, await result.text());
    const publishedPdf = await anonymous(documentUrl);
    assert.equal(publishedPdf.status, 200);
    assert.equal(publishedPdf.headers.get('cache-control'), 'no-store');
    assert.equal(await publishedPdf.text(), originalPdf);
    const home = await (await anonymous(base)).text();
    assert.ok(home.indexOf('href="' + prefix + '/dokumenty/test-document.pdf"') < home.indexOf('href="' + prefix + '/dokumenty/vseobecne-obchodni-podminky.pdf"'));
    result = await update({ additions: [addition(documentPath, documentData(false, true))], deletions: [] });
    assert.equal(result.status, 200, await result.text());
    assert.ok(!(await (await anonymous(base)).text()).includes(`href="${prefix}/dokumenty/test-document.pdf"`));
    assert.equal(await (await anonymous(documentUrl)).text(), originalPdf);
    result = await update({ additions: [addition(documentPath, documentData(true, true))], deletions: [] });
    assert.equal(result.status, 200, await result.text());
    assert.equal((await anonymous(documentUrl)).status, 404);
    result = await update({ additions: [addition(documentPath, documentData(false))], deletions: [] });
    assert.equal(result.status, 200, await result.text());
    assert.ok((await (await anonymous(base)).text()).includes(`href="${prefix}/dokumenty/test-document.pdf"`));
    const replacementPdf = '%PDF-1.7\nReplaced document\n%%EOF';
    result = await update({ additions: [addition(pdfPath, replacementPdf)], deletions: [] });
    assert.equal(result.status, 200, await result.text());
    assert.equal(await (await anonymous(documentUrl)).text(), replacementPdf);
    result = await update({ additions: [addition(pdfPath, 'not a PDF')], deletions: [] });
    assert.equal(result.status, 400);
    assert.equal(await (await anonymous(documentUrl)).text(), replacementPdf);
    result = await update({ additions: [addition(documentPath, documentData(true))], deletions: [] });
    assert.equal(result.status, 200);
    assert.equal((await anonymous(documentUrl)).status, 404);
    assert.ok(!(await (await anonymous(base)).text()).includes(`href="${prefix}/dokumenty/test-document.pdf"`));
    result = await update({ additions: [addition(documentPath, documentData(false))], deletions: [] });
    assert.equal(result.status, 200);

    const staleToken = editor.cookies.get(SESSION_COOKIE);
    assert.equal((await editor.request(base + '/auth/logout', { method: 'POST', headers: { origin: 'https://cizi.example' } })).status, 403);
    assert.equal((await editor.request(base + '/auth/logout', { method: 'POST', headers: { origin } })).status, 303);
    assert.equal((await editor.request(base + '/api/keystatic/tree', { headers: { cookie: `${SESSION_COOKIE}=${staleToken}` } })).status, 401);
    editor = (await login()).browser;
    await stop();
    await start();
    assert.equal((await anonymous(base + '/novinky/live/')).status, 200);
    assert.match(await (await anonymous(base + '/kontakt/')).text(), /<h1>Živé kontakty<\/h1>/);
    assert.equal((await anonymous(base + '/images/novinky/live/test.png')).status, 200);
    assert.equal(await (await anonymous(documentUrl)).text(), replacementPdf);
    assert.equal((await editor.request(base + '/api/keystatic/tree')).status, 401);
    editor = (await login()).browser;
    result = await update({ additions: [], deletions: [{ path }] });
    assert.equal(result.status, 200);
    assert.equal((await anonymous(base + '/novinky/live/')).status, 404);
    result = await update({ additions: [], deletions: [{ path: documentPath }, { path: pdfPath }] });
    assert.equal(result.status, 200);
    assert.equal((await anonymous(documentUrl)).status, 404);
    await stop();
    await start({ OIDC_CLIENT_AUTH_METHOD: 'client_secret_post' });
    const postClient = await login();
    assert.equal(postClient.response.headers.get('location'), route('/keystatic/collection/novinky'));
    await stop();
    await start({ OIDC_ALLOW_ALL_AUTHENTICATED: 'true', OIDC_ALLOWED_SUBJECTS: '' });
    const providerManaged = await login({ test_subject: 'provider-approved-editor' });
    assert.equal(providerManaged.response.headers.get('location'), route('/keystatic/collection/novinky'));
    assert.equal((await providerManaged.browser.request(base + '/keystatic')).status, 200);
    editor = providerManaged.browser;
    result = await update({ additions: [], deletions: [] });
    assert.equal(result.status, 200, await result.text());
    const invalidSignature = await login({ test_subject: 'provider-approved-editor', test_signature: 'bad' });
    assert.equal(invalidSignature.browser.cookies.has(SESSION_COOKIE), false);
    assert.equal((await invalidSignature.browser.request(base + '/api/keystatic/tree')).status, 401);
    assert.equal((await anonymous(base + '/api/keystatic/tree')).status, 401);
    await stop();
    await start({ AUTH_MODE: 'password' });
    assert.equal((await anonymous(base + '/keystatic')).status, 503);
    assert.equal((await anonymous(base + '/api/keystatic/tree')).status, 503);
    assert.equal((await anonymous(base)).status, 200);
    await stop();
    await start({ AUTH_MODE: '', OIDC_CLIENT_SECRET: '' });
    const unconfigured = await anonymous(base + '/api/keystatic/tree', { headers: { authorization: basic } });
    assert.equal(unconfigured.status, 503);
    assert.equal(unconfigured.headers.get('www-authenticate'), null);
    assert.equal((await anonymous(base)).status, 200);
  } finally {
    await stop();
    await provider.close();
    await rm(work, { recursive: true, force: true });
  }
});
