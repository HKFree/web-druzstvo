import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validCredentials, isEditorPath } from '../src/lib/server/auth.mjs';
import { createContentStore, parseArticle, upgradeArticleSource, validateNewsUpdates } from '../src/lib/server/storage.mjs';
import { publishedNews } from '../src/lib/news.mjs';

const source = (title, draft = false) => `---
title: ${title}
publishedAt: 2026-01-01
category: sit
excerpt: Úvod článku
draft: ${draft}
---

## Text článku

[Odkaz](https://hkfree.org)\n\n![Obrázek](/images/novinky/test/image.png)
`;

test('both editor and API paths require credentials, public pages do not', () => {
  for (const path of ['/keystatic', '/keystatic/collection/novinky', '/api/keystatic', '/api/keystatic/update', '/%6beystatic/collection/novinky', '/api/%6beystatic/tree', '/api%2Fkeystatic/tree']) {
    assert.equal(isEditorPath(path), true);
  }
  for (const path of ['/', '/novinky/test/', '/keystatic-other']) assert.equal(isEditorPath(path), false);
  const header = 'Basic ' + Buffer.from('redakce:heslo:s:dvojteckou').toString('base64');
  assert.equal(validCredentials(header, 'redakce', 'heslo:s:dvojteckou'), true);
  assert.equal(validCredentials(header, 'redakce', 'spatne'), false);
  assert.equal(validCredentials(header, 'jiny', 'heslo:s:dvojteckou'), false);
  assert.equal(validCredentials(null, 'redakce', 'heslo'), false);
  assert.equal(validCredentials('Basic !!!', 'redakce', 'heslo'), false);
  assert.equal(validCredentials(header, 'redakce', ''), false);
});

test('saved server content is visible immediately, survives restart and is never reseeded after deletion', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hkfree-content-'));
  try {
    const store = createContentStore(directory, { seed: source('Ukázka') });
    assert.equal((await store.all())[0].data.title, 'Ukázka');
    await writeFile(join(directory, 'content/novinky/new.mdoc'), source('Nová novinka'));
    assert.equal((await store.all()).length, 2);
    await writeFile(join(directory, 'content/novinky/new.mdoc'), source('Upravená novinka'));
    assert.equal((await store.all()).find(item => item.id === 'new').data.title, 'Upravená novinka');
    await unlink(join(directory, 'content/novinky/seed.mdoc'));
    const restarted = createContentStore(directory, { seed: source('Jiná ukázka') });
    assert.deepEqual((await restarted.all()).map(item => item.id), ['new']);
    await writeFile(join(directory, 'content/novinky/new.mdoc'), source('Koncept', true));
    assert.deepEqual(publishedNews(await restarted.all(), '2026-10-15'), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Markdoc dates, formatting and images render; unsafe HTML and links do not', () => {
  const article = parseArticle('test', source('Titulek'));
  assert.equal(article.data.publishedAt, '2026-01-01');
  assert.match(article.html, /<h2>Text článku<\/h2>/);
  assert.match(article.html, /src="\/images\/novinky\/test\/image.png"/);
  const unsafe = parseArticle('unsafe', source('Titulek') + '\n\n[Odkaz](javascript:alert%281%29)\n\n<script>alert(1)</script>');
  assert.doesNotMatch(unsafe.html, /href="javascript:|<script/i);
  assert.throws(() => parseArticle('bad', source('Titulek').replace('2026-01-01', '2026-02-31')));
});

test('legacy news gain explicit local metadata without changing their body or other fields', async () => {
  const original = source('Původní článek', true);
  const upgraded = upgradeArticleSource(original);
  assert.equal(upgraded.replace('\nbody:\n  discriminant: local\n  value: {}', ''), original);
  assert.equal(upgradeArticleSource(upgraded), upgraded);
  assert.deepEqual(parseArticle('test', upgraded), parseArticle('test', original));
  const directory = await mkdtemp(join(tmpdir(), 'hkfree-news-upgrade-'));
  try {
    const store = createContentStore(directory, { legacy: original });
    await store.ready();
    assert.equal(await readFile(join(directory, 'content/novinky/legacy.mdoc'), 'utf8'), upgraded);
    const edited = upgraded + '\n\nRedakční úprava.';
    await writeFile(join(directory, 'content/novinky/legacy.mdoc'), edited);
    await createContentStore(directory, { legacy: source('Jiná ukázka') }).ready();
    assert.equal(await readFile(join(directory, 'content/novinky/legacy.mdoc'), 'utf8'), edited);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Facebook news require a safe Facebook URL, have no rendered body and obey publication rules', () => {
  const facebook = (url, draft = false) => source('Facebook novinka', draft).replace('\n---\n\n', `\nbody:\n  discriminant: facebook\n  value:\n    facebookUrl: ${JSON.stringify(url)}\n---\n\n`);
  const article = parseArticle('facebook', facebook('https://www.facebook.com/hkfree/posts/123'));
  assert.equal(article.data.body.discriminant, 'facebook');
  assert.equal(article.html, '');
  assert.equal(upgradeArticleSource(facebook('https://fb.watch/abc/')), facebook('https://fb.watch/abc/'));
  for (const url of ['https://m.facebook.com/story.php?id=123', 'https://fb.watch/abc/', 'https://www.fb.com/hkfree']) {
    assert.doesNotThrow(() => parseArticle('facebook', facebook(url)));
  }
  for (const url of ['', 'javascript:alert(1)', '//facebook.com/hkfree', 'http://facebook.com/hkfree', 'https://facebook.com.example.org/', 'https://example.org/facebook.com', 'https://facebook.com@evil.example/', 'https://user:pass@facebook.com/', 'https://facebook.com:8443/']) {
    assert.throws(() => parseArticle('facebook', facebook(url)), url);
    assert.throws(() => validateNewsUpdates({ additions: [{ path: 'content/novinky/facebook.mdoc', contents: Buffer.from(facebook(url)).toString('base64url') }] }), url);
  }
  assert.deepEqual(publishedNews([parseArticle('draft', facebook('https://facebook.com/hkfree', true))], '2026-10-19'), []);
  assert.deepEqual(publishedNews([article], '2025-12-31'), []);
});
