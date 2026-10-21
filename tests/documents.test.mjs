import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, unlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import { createDocumentStore, parseDocument, publishedDocuments, validateDocumentUpdates } from '../src/lib/server/documents.mjs';
import { validPdf, MAX_PDF_BYTES } from '../src/lib/pdf.mjs';

const pdf = Buffer.from('%PDF-1.4\nFirst version\n%%EOF');
const data = (id, extra = {}) => ({ title: 'Dokument', order: 10, draft: false, file: `/files/dokumenty/${id}/file.pdf`, ...extra });
const addition = (path, bytes) => ({ path, contents: Buffer.from(bytes).toString('base64') });

test('document metadata, order and draft filtering are validated', () => {
  assert.equal(parseDocument('test', stringify(data('test'))).data.title, 'Dokument');
  assert.equal(parseDocument('test', stringify(data('test'))).data.unlisted, false);
  assert.throws(() => parseDocument('test', stringify(data('test', { unlisted: 'true' }))));
  assert.throws(() => parseDocument('../test', stringify(data('test'))));
  assert.throws(() => parseDocument('test', stringify(data('other'))));
  assert.throws(() => parseDocument('test', stringify(data('test', { file: '/files/dokumenty/../../secret.pdf' }))));
  assert.throws(() => parseDocument('test', stringify(data('test', { order: -1 }))));
  const entries = ['a', 'b', 'c'].map(id => ({ id, data: data(id, { order: id === 'b' ? 1 : 10, draft: id === 'c' }) }));
  assert.deepEqual(publishedDocuments(entries).map(entry => entry.id), ['b', 'a']);
  assert.deepEqual(publishedDocuments([]), []);
});

test('unlisted documents remain available by URL, update immediately and stay private when drafts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hkfree-unlisted-document-'));
  try {
    const seeds = { guide: { data: data('guide', { unlisted: true }), bytes: pdf } };
    const store = createDocumentStore(root, seeds);
    assert.deepEqual(publishedDocuments(await store.all()), []);
    assert.deepEqual((await store.publishedFile('guide')).bytes, pdf);
    await writeFile(join(root, 'content/dokumenty/guide.yaml'), stringify(data('guide', { unlisted: false })));
    assert.equal(publishedDocuments(await store.all()).length, 1);
    for (const unlisted of [false, true]) {
      await writeFile(join(root, 'content/dokumenty/guide.yaml'), stringify(data('guide', { draft: true, unlisted })));
      assert.deepEqual(publishedDocuments(await store.all()), []);
      assert.equal(await store.publishedFile('guide'), undefined);
    }
    await writeFile(join(root, 'content/dokumenty/guide.yaml'), stringify(data('guide', { unlisted: true })));
    const restarted = createDocumentStore(root, seeds);
    assert.deepEqual(publishedDocuments(await restarted.all()), []);
    assert.deepEqual((await restarted.publishedFile('guide')).bytes, pdf);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('documents are installed into an existing site once, survive replacement and never reappear after deletion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hkfree-documents-'));
  try {
    await writeFile(join(root, '.initialized'), '1');
    await mkdir(join(root, 'content/novinky'), { recursive: true });
    await writeFile(join(root, 'content/novinky/existing.mdoc'), 'existing news');
    const seeds = { terms: { data: data('terms'), bytes: pdf } };
    const store = createDocumentStore(root, seeds);
    assert.equal((await store.all()).length, 1);
    assert.deepEqual((await store.publishedFile('terms')).bytes, pdf);
    assert.equal(await readFile(join(root, 'content/novinky/existing.mdoc'), 'utf8'), 'existing news');
    const updated = Buffer.from('%PDF-1.7\nUpdated version\n%%EOF');
    await writeFile(join(root, 'files/dokumenty/terms/file.pdf'), updated);
    const restarted = createDocumentStore(root, seeds);
    assert.deepEqual((await restarted.publishedFile('terms')).bytes, updated);
    await writeFile(join(root, 'content/dokumenty/terms.yaml'), stringify(data('terms', { draft: true })));
    assert.equal(await restarted.publishedFile('terms'), undefined);
    await unlink(join(root, 'content/dokumenty/terms.yaml'));
    assert.deepEqual(await createDocumentStore(root, seeds).all(), []);
    assert.equal(await restarted.publishedFile('../../secret'), undefined);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an existing document is never overwritten during the first documents migration', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hkfree-document-migration-'));
  try {
    await mkdir(join(root, 'content/dokumenty'), { recursive: true });
    await mkdir(join(root, 'files/dokumenty/terms'), { recursive: true });
    await writeFile(join(root, 'content/dokumenty/terms.yaml'), stringify(data('terms', { title: 'Vlastní název' })));
    await writeFile(join(root, 'files/dokumenty/terms/file.pdf'), pdf);
    const store = createDocumentStore(root, { terms: { data: data('terms'), bytes: Buffer.from('%PDF-new') } });
    assert.equal((await store.all())[0].data.title, 'Vlastní název');
    assert.deepEqual((await store.publishedFile('terms')).bytes, pdf);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('new documents are added to initialized installations once without restoring deleted originals or replacing edits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hkfree-document-addition-'));
  try {
    const seeds = { terms: { data: data('terms'), bytes: pdf } };
    await createDocumentStore(root, seeds).ready();
    await unlink(join(root, 'content/dokumenty/terms.yaml'));
    seeds.guide = { data: data('guide'), bytes: pdf };
    const updated = createDocumentStore(root, seeds, ['guide']);
    assert.deepEqual((await updated.all()).map(entry => entry.id), ['guide']);
    const replacement = Buffer.from('%PDF-1.7\nRedakční úprava\n%%EOF');
    await writeFile(join(root, 'files/dokumenty/guide/file.pdf'), replacement);
    await writeFile(join(root, 'content/dokumenty/guide.yaml'), stringify(data('guide', { title: 'Upravený návod', draft: true })));
    const restarted = createDocumentStore(root, seeds, ['guide']);
    assert.equal((await restarted.all())[0].data.title, 'Upravený návod');
    assert.equal(await restarted.publishedFile('guide'), undefined);
    assert.deepEqual(await readFile(join(root, 'files/dokumenty/guide/file.pdf')), replacement);
    await unlink(join(root, 'content/dokumenty/guide.yaml'));
    assert.deepEqual(await createDocumentStore(root, seeds, ['guide']).all(), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('additional document migration preserves an existing record and file with the same slug', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hkfree-document-existing-addition-'));
  try {
    await createDocumentStore(root).ready();
    await mkdir(join(root, 'files/dokumenty/guide'), { recursive: true });
    await writeFile(join(root, 'files/dokumenty/guide/file.pdf'), pdf);
    await writeFile(join(root, 'content/dokumenty/guide.yaml'), stringify(data('guide', { title: 'Vlastní návod' })));
    const store = createDocumentStore(root, { guide: { data: data('guide'), bytes: Buffer.from('%PDF-other') } }, ['guide']);
    assert.equal((await store.all())[0].data.title, 'Vlastní návod');
    assert.deepEqual((await store.publishedFile('guide')).bytes, pdf);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('upload validation rejects invalid PDFs, excessive sizes, missing assets and traversal before writing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hkfree-document-upload-'));
  try {
    const metadata = addition('content/dokumenty/test.yaml', stringify(data('test')));
    const file = addition('files/dokumenty/test/file.pdf', pdf);
    await validateDocumentUpdates({ additions: [metadata, file], deletions: [] }, root);
    await assert.rejects(validateDocumentUpdates({ additions: [metadata], deletions: [] }, root));
    await assert.rejects(validateDocumentUpdates({ additions: [addition(file.path, '<html>Not PDF</html>')], deletions: [] }, root));
    await assert.rejects(validateDocumentUpdates({ additions: [addition('files/dokumenty/test/file.html', pdf)], deletions: [] }, root));
    await assert.rejects(validateDocumentUpdates({ additions: [addition('files/dokumenty/../file.pdf', pdf)], deletions: [] }, root));
    await assert.rejects(validateDocumentUpdates({ additions: [addition(metadata.path, stringify(data('test', { order: -1 }))), file], deletions: [] }, root));
    const oversized = Buffer.alloc(MAX_PDF_BYTES + 1);
    pdf.copy(oversized);
    assert.equal(validPdf(oversized), false);
    assert.equal(validPdf(Buffer.from('%PDF-1.4')), true);
    assert.equal(validPdf(Buffer.from('plain text')), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
