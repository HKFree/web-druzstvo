import { createHash, timingSafeEqual } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest();

export function validCredentials(header, username, password) {
  if (!password || !header?.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  return timingSafeEqual(digest(decoded), digest(`${username}:${password}`));
}

export function isEditorPath(path) {
  // Astro decodes route segments; encoded spellings must have the same protection.
  try { path = decodeURIComponent(path); } catch { return false; }
  return path === '/keystatic' || path.startsWith('/keystatic/')
    || path === '/api/keystatic' || path.startsWith('/api/keystatic/');
}
