import { getSecret } from 'astro:env/server';
import type { z } from 'zod';
import { articleSchema, createContentStore } from './storage.mjs';
import { publishedNews } from '../news.mjs';

const files = import.meta.glob('../../content/novinky/*.mdoc', { query: '?raw', import: 'default', eager: true });
const seeds = Object.fromEntries(Object.entries(files).map(([path, text]) => [path.split('/').pop()!.replace(/\.mdoc$/, ''), text]));
export const contentStore = createContentStore(getSecret('CONTENT_DIR') ?? './data', seeds);
export async function getPublishedNews() {
  const entries: NewsEntry[] = await contentStore.all();
  return publishedNews(entries);
}
export type NewsEntry = { id: string; data: z.infer<typeof articleSchema>; html: string };
