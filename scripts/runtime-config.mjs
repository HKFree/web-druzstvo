import { cp, mkdtemp, readdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeBasePath } from '../src/lib/base-path.mjs';

export const BUILD_BASE = '/__hkfree_runtime_base__';
export const BUILD_DOMAIN = 'runtime.hkfree.invalid';

export function runtimeSettings(env) {
  const domain = (env.DOMAIN ?? '').trim().toLowerCase();
  if (!domain || domain.length > 253 || !domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || domain === BUILD_DOMAIN) {
    throw new Error('DOMAIN musí být platný název serveru bez protokolu, portu a cesty.');
  }
  const base = normalizeBasePath(env.BASE_PATH ?? '/');
  if (base.includes('__hkfree_runtime_base__')) throw new Error('BASE_PATH obsahuje rezervovaný prefix.');
  return { domain, base };
}

export function configureText(text, { domain, base }) {
  // Astro's base itself must stay "/" at root; prefixes of actual URLs disappear.
  // Preserve slash escaping in plain URLs, regex literals and serialized regexes.
  return text.replace(/(["'`])\/__hkfree_runtime_base__\1/g, (_match, quote) => `${quote}${base || '/'}${quote}`)
    .replace(/(\\*)\/__hkfree_runtime_base__/g, (_match, escapes) => base.replaceAll('/', `${escapes}/`))
    .replaceAll(BUILD_DOMAIN, domain);
}

export async function prepareRuntime(template, env = process.env) {
  const settings = runtimeSettings(env);
  const manifest = JSON.parse(await readFile(join(template, 'runtime-template.json'), 'utf8'));
  if (manifest.base !== BUILD_BASE || manifest.domain !== BUILD_DOMAIN) throw new Error('Neplatná šablona aplikace. Spusťte npm run build.');
  const root = await mkdtemp(join(tmpdir(), 'hkfree-runtime-'));
  try {
    await cp(template, join(root, 'dist'), { recursive: true });
    await symlink(resolve(dirname(template), 'node_modules'), join(root, 'node_modules'), 'dir');
    await writeFile(join(root, 'package.json'), '{"type":"module"}\n');
    async function configure(directory) {
      for (const item of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, item.name);
        if (item.isDirectory()) { await configure(path); continue; }
        if (!/\.(?:mjs|js|css|html|json|map)$/.test(item.name)) continue;
        const text = await readFile(path, 'utf8');
        const result = configureText(text, settings);
        if (result.includes('__hkfree_runtime_base__') || result.includes(BUILD_DOMAIN)) throw new Error(`Nenahrazená konfigurace: ${item.name}`);
        if (result !== text) await writeFile(path, result);
      }
    }
    await rm(join(root, 'dist/runtime-template.json'));
    await configure(join(root, 'dist'));
    return { root, entrypoint: join(root, 'dist/server/entry.mjs'), ...settings };
  } catch (error) { await rm(root, { recursive: true, force: true }); throw error; }
}
