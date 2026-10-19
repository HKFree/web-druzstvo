import { mkdir, readdir, readFile, writeFile, access, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import Markdoc from '@markdoc/markdoc';
import { parse } from 'yaml';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { prefixPath } from '../base-path.mjs';
import { isFacebookUrl } from '../news.mjs';

export const articleSchema = z.object({
  title: z.string().min(1),
  publishedAt: z.preprocess(value => value instanceof Date ? value.toISOString().slice(0, 10) : value, z.iso.date()),
  category: z.enum(['sit', 'komunita', 'druzstvo']),
  excerpt: z.string().min(1).max(300),
  draft: z.boolean().default(true),
  body: z.discriminatedUnion('discriminant', [
    z.object({ discriminant: z.literal('local'), value: z.object({}).default({}) }),
    z.object({ discriminant: z.literal('facebook'), value: z.object({
      facebookUrl: z.string().refine(isFacebookUrl, 'Neplatný odkaz na Facebook.'),
    }) }),
  ]).default({ discriminant: 'local', value: {} }),
});

export function parseArticle(id, source, base = '') {
  const ast = Markdoc.parse(source);
  const data = articleSchema.parse(parse(ast.attributes.frontmatter ?? ''));
  return { id, data, html: data.body.discriminant === 'local' ? renderContent(ast, base) : '' };
}

// Keystatic's conditional field needs explicit metadata to load the existing
// Markdown body. Insert just that metadata, preserving all original text/fields.
export function upgradeArticleSource(source) {
  const frontmatter = parse(Markdoc.parse(source).attributes.frontmatter ?? '');
  if (frontmatter && Object.hasOwn(frontmatter, 'body')) return source;
  articleSchema.parse(frontmatter);
  const upgraded = source.replace(/^(---\r?\n[\s\S]*?)(\r?\n---(?:\r?\n|$))/, '$1\nbody:\n  discriminant: local\n  value: {}$2');
  if (upgraded === source) throw new Error('Novinka nemá platnou YAML hlavičku.');
  return upgraded;
}

export function validateNewsUpdates(payload) {
  if (!Array.isArray(payload?.additions)) return;
  for (const addition of payload.additions) {
    if (typeof addition.path !== 'string' || !addition.path.startsWith('content/novinky/')) continue;
    const match = /^content\/novinky\/([a-zA-Z0-9_-]+)\.mdoc$/.exec(addition.path);
    if (!match || typeof addition.contents !== 'string') throw new Error('Neplatná cesta novinky.');
    parseArticle(match[1], Buffer.from(addition.contents, 'base64').toString('utf8'));
  }
}

export function renderContent(ast, base = '') {
  return sanitizeHtml(Markdoc.renderers.html(Markdoc.transform(ast)), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title', 'width', 'height'],
    },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, ...(attribs.href ? { href: prefixPath(attribs.href, base) } : {}) } }),
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, ...(attribs.src ? { src: prefixPath(attribs.src, base) } : {}) } }),
    },
  });
}

export function createContentStore(directory, seeds = {}, base = '') {
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
    return initialized ??= initialize().then(async () => {
      const files = await readdir(join(root, 'content/novinky'));
      for (const file of files.filter(file => /^[a-zA-Z0-9_-]+\.mdoc$/.test(file))) {
        const path = join(root, 'content/novinky', file);
        const source = await readFile(path, 'utf8');
        const upgraded = upgradeArticleSource(source);
        if (upgraded === source) continue;
        await writeFile(`${path}.tmp`, upgraded);
        await rename(`${path}.tmp`, path);
      }
    }).catch(error => { initialized = undefined; throw error; });
  }
  async function all() {
    await ready();
    const files = await readdir(join(root, 'content/novinky'));
    return Promise.all(files.filter(file => /^[a-zA-Z0-9_-]+\.mdoc$/.test(file)).map(async file => {
      const source = await readFile(join(root, 'content/novinky', file), 'utf8');
      return parseArticle(file.slice(0, -5), source, base);
    }));
  }
  return { root, ready, all };
}
