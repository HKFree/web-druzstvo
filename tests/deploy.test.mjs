import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const exec = promisify(execFile);
const script = resolve('deploy/deploy.sh');

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'hkfree-deploy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const remote = join(root, 'remote.git');
  const source = join(root, 'source');
  const live = join(root, 'live');
  const bin = join(root, 'bin');
  const log = join(root, 'docker.log');
  await mkdir(source); await mkdir(bin);
  const git = async (cwd, ...args) => (await exec('git', args, { cwd })).stdout.trim();
  await git(root, 'init', '--bare', '-b', 'main', remote);
  await git(source, 'init', '-b', 'main');
  await git(source, 'config', 'user.name', 'Deploy test');
  await git(source, 'config', 'user.email', 'deploy@example.test');
  await writeFile(join(source, '.gitignore'), '.env\ndata/\n');
  await writeFile(join(source, 'version'), 'old');
  await git(source, 'add', '.'); await git(source, 'commit', '-qm', 'old');
  const old = await git(source, 'rev-parse', 'HEAD');
  await writeFile(join(source, 'version'), 'new');
  await git(source, 'commit', '-qam', 'new');
  const target = await git(source, 'rev-parse', 'HEAD');
  await git(source, 'remote', 'add', 'origin', remote);
  await git(source, 'push', 'origin', 'main');
  await git(root, 'clone', remote, live);
  await git(live, 'checkout', '--detach', old);
  await writeFile(join(live, '.env'), 'OIDC_CLIENT_SECRET=local-test-only\nBASE_PATH=/v2\nWEB_IMAGE=old-image\n');
  await mkdir(join(live, 'data')); await writeFile(join(live, 'data/editor-content'), 'Keep my content');
  await writeFile(join(bin, 'docker'), `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const args=process.argv.slice(2);
appendFileSync(process.env.MOCK_DOCKER_LOG,JSON.stringify(args)+'\\n');
if(args[0]==='inspect') console.log('web-druzstvo_content');
else if(args[0]==='image'&&args[1]==='inspect') console.log(process.env.MOCK_IMAGE_REVISION||process.env.MOCK_REVISION);
else if(args[0]==='compose'&&args[1]==='ps') console.log('old-container');
else if(args[0]==='compose'&&args[1]==='config') console.log(JSON.stringify({volumes:{content:{name:process.env.MOCK_VOLUME||'web-druzstvo_content'}},services:{web:{environment:{BASE_PATH:'/v2'},image:process.env.WEB_IMAGE}}}));
else if(args[0]==='compose'&&args[1]==='pull'&&process.env.MOCK_PULL_FAIL==='1') process.exit(1);
else if(args[0]==='compose'&&args[1]==='run'&&process.env.MOCK_CONFIG_FAIL==='1') process.exit(1);
else if(args[0]==='compose'&&args[1]==='exec'&&process.env.MOCK_HEALTH_FAIL==='1') process.exit(1);
`, { mode: 0o755 });
  await writeFile(join(bin, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const image = 'ghcr.io/hkfree/web-druzstvo@sha256:' + 'a'.repeat(64);
  const run = (sha = target, extra = {}) => exec('bash', [script, sha, live, image], { env: {
    ...process.env, PATH: bin + ':' + process.env.PATH, MOCK_DOCKER_LOG: log, MOCK_REVISION: target, ...extra,
  } });
  const commands = async () => (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  return { live, old, target, image, git, run, commands };
}

test('deploy uses a tested image digest, keeps server secrets/content, pulls before switching and checks the prefix', async t => {
  const f = await fixture(t);
  const result = await f.run();
  assert.equal(await f.git(f.live, 'rev-parse', 'HEAD'), f.target);
  assert.equal(await readFile(join(f.live, 'version'), 'utf8'), 'new');
  assert.equal(await readFile(join(f.live, '.env'), 'utf8'), `OIDC_CLIENT_SECRET=local-test-only\nBASE_PATH=/v2\nWEB_IMAGE=${f.image}\n`);
  assert.equal(await readFile(join(f.live, 'data/editor-content'), 'utf8'), 'Keep my content');
  const commands = await f.commands();
  const pull = commands.findIndex(args => args[1] === 'pull');
  const up = commands.findIndex(args => args[1] === 'up');
  assert.ok(pull >= 0 && up > pull);
  assert.ok(commands.every(args => args[1] !== 'build'));
  assert.ok(commands.some(args => args[1] === 'exec' && args.at(-1) === '/v2/'));
  assert.ok(commands.every(args => !args.includes('down') && !args.includes('rm')));
  assert.match(result.stdout, /HTTP check passed/);
  assert.doesNotMatch(result.stdout + result.stderr, /local-test-only/);
});

test('deploy refuses dirty checkouts and does not overwrite local edits', async t => {
  const f = await fixture(t);
  await writeFile(join(f.live, 'version'), 'Manual edit');
  await assert.rejects(f.run(), error => /local changes/.test(error.stderr));
  assert.equal(await readFile(join(f.live, 'version'), 'utf8'), 'Manual edit');
  assert.equal(await f.git(f.live, 'rev-parse', 'HEAD'), f.old);
});

test('image persistence preserves existing env bytes and duplicate image keys abort before activation', async t => {
  const f = await fixture(t);
  const original = '# server comment\r\nOIDC_CLIENT_SECRET="test-only # value"\r\nBASE_PATH=/v2\r\n';
  await writeFile(join(f.live, '.env'), original);
  await f.run();
  assert.equal(await readFile(join(f.live, '.env'), 'utf8'), original + `WEB_IMAGE=${f.image}\n`);
  const duplicate = await fixture(t);
  const invalid = original + 'WEB_IMAGE=one\nWEB_IMAGE=two\n';
  await writeFile(join(duplicate.live, '.env'), invalid);
  await assert.rejects(duplicate.run(), error => /Duplicate WEB_IMAGE/.test(error.stderr));
  assert.equal(await readFile(join(duplicate.live, '.env'), 'utf8'), invalid);
  assert.equal(await duplicate.git(duplicate.live, 'rev-parse', 'HEAD'), duplicate.old);
  assert.ok((await duplicate.commands()).every(args => args[1] !== 'up'));
});

test('deploy refuses a different content volume and restores the previous checkout', async t => {
  const f = await fixture(t);
  await assert.rejects(f.run(f.target, { MOCK_VOLUME: 'wrong_content' }), error => /volume would change/.test(error.stderr));
  assert.equal(await f.git(f.live, 'rev-parse', 'HEAD'), f.old);
  assert.ok((await f.commands()).every(args => args[1] !== 'build' && args[1] !== 'up'));
});

test('a failed pull leaves the existing container and environment alone and restores the previous checkout', async t => {
  const f = await fixture(t);
  await f.git(f.live, 'checkout', '-b', 'server-main');
  await assert.rejects(f.run(f.target, { MOCK_PULL_FAIL: '1' }));
  assert.equal(await f.git(f.live, 'rev-parse', 'HEAD'), f.old);
  assert.equal(await f.git(f.live, 'symbolic-ref', '--short', 'HEAD'), 'server-main');
  assert.ok((await f.commands()).every(args => args[1] !== 'up'));
  assert.match(await readFile(join(f.live, '.env'), 'utf8'), /WEB_IMAGE=old-image/);
});

test('deploy refuses an image from another commit or invalid startup configuration before activation', async t => {
  for (const extra of [{ MOCK_IMAGE_REVISION: 'b'.repeat(40) }, { MOCK_CONFIG_FAIL: '1' }]) {
    const f = await fixture(t);
    await assert.rejects(f.run(f.target, extra));
    assert.equal(await f.git(f.live, 'rev-parse', 'HEAD'), f.old);
    assert.ok((await f.commands()).every(args => args[1] !== 'up'));
    assert.match(await readFile(join(f.live, '.env'), 'utf8'), /WEB_IMAGE=old-image/);
  }
});

test('a failed HTTP check reports failure instead of pretending rollback succeeded', async t => {
  const f = await fixture(t);
  await assert.rejects(f.run(f.target, { MOCK_HEALTH_FAIL: '1' }), error => /no automatic rollback/.test(error.stderr));
  assert.equal(await f.git(f.live, 'rev-parse', 'HEAD'), f.target);
  assert.equal((await f.commands()).filter(args => args[1] === 'exec').length, 12);
});

test('old CI runs cannot overwrite a newer main commit', async t => {
  const f = await fixture(t);
  const result = await f.run(f.old);
  assert.match(result.stdout, /Skipping/);
  assert.equal(await f.git(f.live, 'rev-parse', 'HEAD'), f.old);
  assert.ok((await f.commands()).every(args => args[1] !== 'build' && args[1] !== 'up'));
});
