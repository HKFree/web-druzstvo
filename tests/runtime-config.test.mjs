import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BUILD_BASE, BUILD_DOMAIN, configureText, runtimeSettings, prepareRuntime } from '../scripts/runtime-config.mjs';

test('startup validates runtime domains and paths before modifying files', () => {
  assert.deepEqual(runtimeSettings({ DOMAIN: 'Web.Example', BASE_PATH: '/test/v2/' }), { domain: 'web.example', base: '/test/v2' });
  for (const DOMAIN of ['', 'https://web.example', 'web.example:443', 'web.example/path', '-evil.test', "x';exit(1)//", BUILD_DOMAIN]) {
    assert.throws(() => runtimeSettings({ DOMAIN }));
  }
  for (const BASE_PATH of ['v2', '//evil', '/a/../b', '/a%2fb', '/x?y', BUILD_BASE]) assert.throws(() => runtimeSettings({ DOMAIN: 'web.example', BASE_PATH }));
});

test('startup substitutes URLs and escaped regexes for root and nested prefixes', () => {
  const source = String.raw`"/__hkfree_runtime_base__/_astro/file.js" /^\/__hkfree_runtime_base__\/keystatic/ "^\\/__hkfree_runtime_base__\\/keystatic" runtime.hkfree.invalid https://external.example/path`;
  for (const base of ['', '/v2', '/test/v2']) {
    const output = configureText(source, { domain: 'web.example', base });
    assert.ok(output.includes(`"${base}/_astro/file.js"`));
    assert.ok(output.includes(`/^${base.replaceAll('/', '\\/')}\\/keystatic/`));
    assert.ok(output.includes(`"^${base.replaceAll('/', '\\\\/')}\\\\/keystatic"`));
    assert.ok(output.includes('web.example https://external.example/path'));
    assert.equal(configureText(`base="${BUILD_BASE}"`, { domain: 'web.example', base }), `base="${base || '/'}"`);
    assert.doesNotMatch(output, /__hkfree_runtime_base__|runtime\.hkfree\.invalid/);
  }
});

test('one immutable template creates independent configured copies and preserves binary assets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hkfree-template-test-'));
  const template = join(root, 'dist');
  const prepared = [];
  try {
    await mkdir(join(template, 'client'), { recursive: true });
    await writeFile(join(template, 'runtime-template.json'), JSON.stringify({ base: BUILD_BASE, domain: BUILD_DOMAIN }));
    const source = `path="${BUILD_BASE}/_astro/test.js";host="${BUILD_DOMAIN}";`;
    await writeFile(join(template, 'client/test.js'), source);
    const binary = Buffer.from('%PDF-1.7\n/__hkfree_runtime_base__/\n');
    await writeFile(join(template, 'client/test.pdf'), binary);
    for (const [DOMAIN, BASE_PATH] of [['a.example', '/'], ['b.example', '/v2']]) {
      const copy = await prepareRuntime(template, { DOMAIN, BASE_PATH });
      prepared.push(copy.root);
      assert.equal(await readFile(join(copy.root, 'dist/client/test.js'), 'utf8'), `path="${BASE_PATH === '/' ? '' : BASE_PATH}/_astro/test.js";host="${DOMAIN}";`);
      assert.deepEqual(await readFile(join(copy.root, 'dist/client/test.pdf')), binary);
      assert.equal(await readFile(join(template, 'client/test.js'), 'utf8'), source);
    }
    assert.notEqual(prepared[0], prepared[1]);
  } finally {
    await Promise.all([root, ...prepared].map(path => rm(path, { recursive: true, force: true })));
  }
});
