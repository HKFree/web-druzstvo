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
  await writeFile(join(live, '.env'), 'OIDC_CLIENT_SECRET=local-test-only\nBASE_PATH=/v2\n');
  await mkdir(join(live, 'data')); await writeFile(join(live, 'data/editor-content'), 'Keep my content');
  await writeFile(join(bin, 'docker'), `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const args=process.argv.slice(2);
appendFileSync(process.env.MOCK_DOCKER_LOG,JSON.stringify(args)+'\\n');
if(args[0]==='inspect') console.log('web-druzstvo_content');
else if(args[0]==='compose'&&args[1]==='ps') console.log('old-container');
else if(args[0]==='compose'&&args[1]==='config') console.log(JSON.stringify({volumes:{content:{name:process.env.MOCK_VOLUME||'web-druzstvo_content'}},services:{web:{build:{args:{BASE_PATH:'/v2'}}}}}));
else if(args[0]==='compose'&&args[1]==='build'&&process.env.MOCK_BUILD_FAIL==='1') process.exit(1);
else if(args[0]==='compose'&&args[1]==='exec'&&process.env.MOCK_HEALTH_FAIL==='1') process.exit(1);
`, { mode: 0o755 });
  await writeFile(join(bin, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const run = (sha = target, extra = {}) => exec('bash', [script, sha, live], { env: {
    ...process.env, PATH: bin + ':' + process.env.PATH, MOCK_DOCKER_LOG: log, ...extra,
  } });
  const commands = async () => (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  return { live, old, target, git, run, commands };
}

test('deploy uses the tested commit, keeps server secrets/content, builds before switching and checks the prefix', async t => {
  const f = await fixture(t);
  const result = await f.run();
  assert.equal(await f.git(f.live, 'rev-parse', 'HEAD'), f.target);
  assert.equal(await readFile(join(f.live, 'version'), 'utf8'), 'new');
  assert.equal(await readFile(join(f.live, '.env'), 'utf8'), 'OIDC_CLIENT_SECRET=local-test-only\nBASE_PATH=/v2\n');
  assert.equal(await readFile(join(f.live, 'data/editor-content'), 'utf8'), 'Keep my content');
  const commands = await f.commands();
  const build = commands.findIndex(args => args[1] === 'build');
  const up = commands.findIndex(args => args[1] === 'up');
  assert.ok(build >= 0 && up > build);
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

test('deploy refuses a different content volume and restores the previous checkout', async t => {
  const f = await fixture(t);
  await assert.rejects(f.run(f.target, { MOCK_VOLUME: 'wrong_content' }), error => /volume would change/.test(error.stderr));
  assert.equal(await f.git(f.live, 'rev-parse', 'HEAD'), f.old);
  assert.ok((await f.commands()).every(args => args[1] !== 'build' && args[1] !== 'up'));
});

test('a failed build leaves the existing container alone and restores the previous checkout', async t => {
  const f = await fixture(t);
  await f.git(f.live, 'checkout', '-b', 'server-main');
  await assert.rejects(f.run(f.target, { MOCK_BUILD_FAIL: '1' }));
  assert.equal(await f.git(f.live, 'rev-parse', 'HEAD'), f.old);
  assert.equal(await f.git(f.live, 'symbolic-ref', '--short', 'HEAD'), 'server-main');
  assert.ok((await f.commands()).every(args => args[1] !== 'up'));
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
