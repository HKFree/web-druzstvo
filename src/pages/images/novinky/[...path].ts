import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { contentStore } from '../../../lib/server/content';

const types: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml',
};
export const GET: APIRoute = async ({ params }) => {
  const root = resolve(contentStore.root, 'images/novinky');
  const file = resolve(root, params.path ?? '');
  const type = types[extname(file).toLowerCase()];
  if (!file.startsWith(root + sep) || !type) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(file);
    return new Response(new Uint8Array(bytes), { headers: {
      'Content-Type': type, 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'no-cache',
    } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Response(null, { status: 404 });
    throw error;
  }
};
