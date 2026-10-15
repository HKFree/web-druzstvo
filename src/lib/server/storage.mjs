import { mkdir, readdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import Markdoc from '@markdoc/markdoc';
import { parse } from 'yaml';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';

export const articleSchema = z.object({
  title: z.string().min(1),
  publishedAt: z.preprocess(value => value instanceof Date ? value.toISOString().slice(0, 10) : value, z.iso.date()),
  category: z.enum(['sit', 'komunita', 'druzstvo']),
  excerpt: z.string().min(1).max(300),
  draft: z.boolean().default(true),
});

export function parseArticle(id, source) {
  const ast = Markdoc.parse(source);
  const data = articleSchema.parse(parse(ast.attributes.frontmatter ?? ''));
  const html = sanitizeHtml(Markdoc.renderers.html(Markdoc.transform(ast)), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title', 'width', 'height'],
    },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    allowProtocolRelative: false,
  });
  return { id, data, html };
}

export function createContentStore(directory, seeds = {}) {
  const root = resolve(directory);
  let initialized;
  async function initialize() {
    await mkdir(join(root, 'content/novinky'), { recursive: true });
    await mkdir(join(root, 'images/novinky'), { recursive: true });
    try { await access(join(root, '.initialized')); return; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    // A seed is copied once, never on every restart or application update.
    for (const [id, source] of Object.entries(seeds)) {
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid seed slug');
      try { await writeFile(join(root, 'content/novinky', `${id}.mdoc`), source, { flag: 'wx' }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    await writeFile(join(root, '.initialized'), '1\n');
  }
  function ready() {
    return initialized ??= initialize().catch(error => { initialized = undefined; throw error; });
  }
  async function all() {
    await ready();
    const files = await readdir(join(root, 'content/novinky'));
    return Promise.all(files.filter(file => /^[a-zA-Z0-9_-]+\.mdoc$/.test(file)).map(async file => {
      const source = await readFile(join(root, 'content/novinky', file), 'utf8');
      return parseArticle(file.slice(0, -5), source);
    }));
  }
  return { root, ready, all };
}
