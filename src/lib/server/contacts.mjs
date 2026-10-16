import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Markdoc from '@markdoc/markdoc';
import { parse } from 'yaml';
import { z } from 'zod';
import { renderContent } from './storage.mjs';

const schema = z.object({ title: z.string().trim().min(1), description: z.string().trim().min(1) });
export function parseContactPage(source, base = '') {
  const ast = Markdoc.parse(source);
  return { data: schema.parse(parse(ast.attributes.frontmatter ?? '')), html: renderContent(ast, base) };
}

export function createContactStore(root, seed, base = '') {
  const directory = join(root, 'content/stranky');
  const file = join(directory, 'kontakt.mdoc');
  let initialized;
  async function initialize() {
    await mkdir(directory, { recursive: true });
    // Install on existing sites too, while preserving every saved editorial change.
    try { await writeFile(file, seed, { flag: 'wx' }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  function ready() {
    return initialized ??= initialize().catch(error => { initialized = undefined; throw error; });
  }
  async function read() {
    await ready();
    return parseContactPage(await readFile(file, 'utf8'), base);
  }
  return { ready, read };
}
