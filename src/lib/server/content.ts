import { getSecret } from 'astro:env/server';
import type { z } from 'zod';
import { articleSchema, createContentStore } from './storage.mjs';
import { publishedNews } from '../news.mjs';
import documentDefaults from '../../content/dokumenty/initial.json';
import { createDocumentStore, publishedDocuments, documentSchema } from './documents.mjs';
import contactSeed from '../../content/stranky/kontakt.mdoc?raw';
import { createContactStore } from './contacts.mjs';
import { basePath } from '../paths';

const files = import.meta.glob('../../content/novinky/*.mdoc', { query: '?raw', import: 'default', eager: true });
const seeds = Object.fromEntries(Object.entries(files).map(([path, text]) => [path.split('/').pop()!.replace(/\.mdoc$/, ''), text]));
export const contentStore = createContentStore(getSecret('CONTENT_DIR') ?? './data', seeds, basePath);
export const contactStore = createContactStore(contentStore.root, contactSeed, basePath);
export async function getPublishedNews() {
  const entries: NewsEntry[] = await contentStore.all();
  return publishedNews(entries);
}
export type NewsEntry = { id: string; data: z.infer<typeof articleSchema>; html: string };

const documentFiles = import.meta.glob('../../content/dokumenty/files/*.pdf', { query: '?inline', import: 'default', eager: true });
const documentSeeds = Object.fromEntries(documentDefaults.map(({ id, title, order, draft, file }) => {
  const asset = documentFiles[`../../content/dokumenty/files/${id}.pdf`];
  if (typeof asset !== 'string' || !asset.startsWith('data:application/pdf;base64,')) throw new Error(`Missing bundled PDF: ${id}`);
  return [id, { data: { title, order, draft, file }, bytes: Buffer.from(asset.split(',')[1], 'base64') }];
}));
export const documentStore = createDocumentStore(contentStore.root, documentSeeds, ['navod-na-podpis-smlouvy']);
export async function getPublishedDocuments(): Promise<DocumentEntry[]> {
  return publishedDocuments(await documentStore.all());
}
export type DocumentEntry = { id: string; data: z.infer<typeof documentSchema> };
