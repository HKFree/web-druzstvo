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
  assert.throws(() => parseDocument('../test', stringify(data('test'))));
  assert.throws(() => parseDocument('test', stringify(data('other'))));
  assert.throws(() => parseDocument('test', stringify(data('test', { file: '/files/dokumenty/../../secret.pdf' }))));
  assert.throws(() => parseDocument('test', stringify(data('test', { order: -1 }))));
  const entries = ['a', 'b', 'c'].map(id => ({ id, data: data(id, { order: id === 'b' ? 1 : 10, draft: id === 'c' }) }));
  assert.deepEqual(publishedDocuments(entries).map(entry => entry.id), ['b', 'a']);
  assert.deepEqual(publishedDocuments([]), []);
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
