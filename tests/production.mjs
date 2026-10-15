import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';

// Run against the built production server, without a checkout in its working directory.
// No GitHub credentials, database, browser or external service is needed.
test('production editing publishes immediately and survives an application restart', async () => {
  const work = await mkdtemp(join(tmpdir(), 'hkfree-production-'));
  const socket = createServer();
  await new Promise(done => socket.listen(0, '127.0.0.1', done));
  const port = socket.address().port;
  await new Promise(done => socket.close(done));
  const base = `http://127.0.0.1:${port}`;
  const password = randomBytes(24).toString('hex');
  const entrypoint = resolve('dist/server/entry.mjs');
  const authorization = 'Basic ' + Buffer.from(`test:${password}`).toString('base64');
  let server;
  let logs = '';
  async function start(withPassword = true) {
    server = spawn(process.execPath, [entrypoint], {
      cwd: work,
      env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
        CONTENT_DIR: join(work, 'content'), ADMIN_USERNAME: 'test', ADMIN_PASSWORD: withPassword ? password : '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', chunk => { logs += chunk; });
    server.stderr.on('data', chunk => { logs += chunk; });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(logs);
      try { if ((await fetch(base)).ok) return; } catch {}
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
  const source = draft => `---\ntitle: Živá novinka\npublishedAt: 2026-01-01\ncategory: sit\nexcerpt: Úprava bez sestavení\ndraft: ${draft}\n---\n\nText novinky.\n\n![Test](/images/novinky/live/test.png)\n`;
  const addition = (path, contents) => ({ path, contents: Buffer.from(contents).toString('base64url') });
  const update = (data, origin = base) => fetch(base + '/api/keystatic/update', {
    method: 'POST', headers: { authorization, origin, 'content-type': 'application/json', 'no-cors': '1' },
    body: JSON.stringify(data),
  });
  try {
    await start();
    for (const path of ['/keystatic', '/api/keystatic/tree', '/api/%6beystatic/tree', '/%6beystatic/collection/novinky']) {
      assert.equal((await fetch(base + path)).status, 401, path);
    }
    const path = 'content/novinky/live.mdoc';
    let result = await update({ additions: [addition(path, source(true))], deletions: [] });
    assert.equal(result.status, 200, await result.text());
    assert.equal((await fetch(base + '/novinky/live/')).status, 404);
    assert.doesNotMatch(await (await fetch(base + '/novinky/')).text(), /Živá novinka/);
    result = await update({ additions: [addition(path, source(false)), addition('images/novinky/live/test.png', Buffer.from([137, 80, 78, 71]))], deletions: [] });
    assert.equal(result.status, 200, await result.text());
    let page = await fetch(base + '/novinky/live/');
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('cache-control'), 'no-store');
    assert.match(await page.text(), /Úprava bez sestavení/);
    assert.match(await (await fetch(base + '/novinky/')).text(), /Živá novinka/);
    assert.equal((await fetch(base + '/images/novinky/live/test.png')).headers.get('content-type'), 'image/png');
    assert.equal((await update({ additions: [], deletions: [] }, 'https://cizi.example')).status, 403);
    await stop();
    await start();
    assert.equal((await fetch(base + '/novinky/live/')).status, 200);
    assert.equal((await fetch(base + '/images/novinky/live/test.png')).status, 200);
    result = await update({ additions: [], deletions: [{ path }] });
    assert.equal(result.status, 200);
    assert.equal((await fetch(base + '/novinky/live/')).status, 404);
    await stop();
    await start(false);
    assert.equal((await fetch(base + '/keystatic')).status, 503);
    assert.equal((await fetch(base + '/api/keystatic/tree')).status, 503);
    assert.equal((await fetch(base)).status, 200);
  } finally {
    await stop();
    await rm(work, { recursive: true, force: true });
  }
});
