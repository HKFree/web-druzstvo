import { mkdir, readdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parse, stringify } from 'yaml';
import { z } from 'zod';
import { validPdf } from '../pdf.mjs';

const slugPattern = /^[a-zA-Z0-9_-]+$/;
export const documentSchema = z.object({
  title: z.string().min(1).max(200),
  order: z.number().int().min(0),
  draft: z.boolean().default(true),
  file: z.string().regex(/^\/files\/dokumenty\/[a-zA-Z0-9_-]+\/file\.pdf$/i),
});

export function parseDocument(id, source) {
  if (!slugPattern.test(id)) throw new Error('Neplatný identifikátor dokumentu.');
  const data = documentSchema.parse(parse(source));
  if (data.file.slice(0, -4) !== `/files/dokumenty/${id}/file`) throw new Error('Soubor nepatří k tomuto dokumentu.');
  return { id, data };
}

export const documentUrl = id => `/dokumenty/${id}.pdf`;
export function publishedDocuments(entries) {
  return entries.filter(entry => !entry.data.draft)
    .sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id));
}

export function createDocumentStore(directory, seeds = {}) {
  const root = resolve(directory);
  const metadata = join(root, 'content/dokumenty');
  let initialized;
  const assetPath = record => join(root, record.data.file.slice(1));
  async function initialize() {
    await mkdir(metadata, { recursive: true });
    await mkdir(join(root, 'files/dokumenty'), { recursive: true });
    // Separate migration marker also installs documents into existing news-only sites.
    try { await access(join(root, '.documents-initialized')); return; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const [id, seed] of Object.entries(seeds)) {
      const record = parseDocument(id, stringify(seed.data));
      if (!validPdf(seed.bytes)) throw new Error(`Neplatný počáteční PDF soubor: ${id}`);
      try { await access(join(metadata, `${id}.yaml`)); continue; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      await mkdir(join(root, 'files/dokumenty', id), { recursive: true });
      try { await writeFile(assetPath(record), seed.bytes, { flag: 'wx' }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      await writeFile(join(metadata, `${id}.yaml`), stringify(seed.data), { flag: 'wx' });
    }
    await writeFile(join(root, '.documents-initialized'), '1\n');
  }
  function ready() {
    return initialized ??= initialize().catch(error => { initialized = undefined; throw error; });
  }
  async function read(id) {
    if (!slugPattern.test(id)) return undefined;
    await ready();
    try { return parseDocument(id, await readFile(join(metadata, `${id}.yaml`), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
  }
  async function all() {
    await ready();
    const files = await readdir(metadata);
    const entries = await Promise.all(files.filter(file => /^[a-zA-Z0-9_-]+\.yaml$/.test(file)).map(file => read(file.slice(0, -5))));
    return entries.filter(Boolean);
  }
  async function publishedFile(id) {
    const entry = await read(id);
    if (!entry || entry.data.draft) return undefined;
    try {
      const bytes = await readFile(assetPath(entry));
      return validPdf(bytes) ? { ...entry, bytes } : undefined;
    } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
  }
  return { root, ready, all, publishedFile };
}

// Validate uploads before Keystatic writes them, including direct API requests.
export async function validateDocumentUpdates(payload, root) {
  if (!Array.isArray(payload?.additions)) return;
  const additions = new Map();
  for (const addition of payload.additions) {
    if (typeof addition.path !== 'string' || typeof addition.contents !== 'string') continue;
    if (!addition.path.startsWith('files/dokumenty/') && !addition.path.startsWith('content/dokumenty/')) continue;
    const bytes = Buffer.from(addition.contents, 'base64');
    if (addition.path.startsWith('files/dokumenty/')) {
      if (!/^files\/dokumenty\/[a-zA-Z0-9_-]+\/file\.pdf$/i.test(addition.path) || !validPdf(bytes)) {
        throw new Error('Nahrajte PDF soubor o velikosti nejvýše 10 MB.');
      }
    }
    additions.set(addition.path, bytes);
  }
  for (const [path, bytes] of additions) {
    if (!path.startsWith('content/dokumenty/')) continue;
    const match = /^content\/dokumenty\/([a-zA-Z0-9_-]+)\.yaml$/.exec(path);
    if (!match) throw new Error('Neplatná cesta dokumentu.');
    const record = parseDocument(match[1], bytes.toString('utf8'));
    const asset = record.data.file.slice(1);
    if (payload.deletions?.some(item => item.path === asset) && !additions.has(asset)) throw new Error('PDF dokumentu nesmí chybět.');
    let file = additions.get(asset);
    if (!file) {
      try { file = await readFile(join(root, asset)); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (!validPdf(file)) throw new Error('Vyberte platný PDF soubor o velikosti nejvýše 10 MB.');
  }
}
