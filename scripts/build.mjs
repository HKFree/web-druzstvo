import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { BUILD_BASE, BUILD_DOMAIN } from './runtime-config.mjs';

const child = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, HKFREE_RUNTIME_BUILD: '1' },
});
child.on('exit', async code => {
  if (code !== 0) { process.exitCode = code ?? 1; return; }
  await writeFile('dist/runtime-template.json', JSON.stringify({ base: BUILD_BASE, domain: BUILD_DOMAIN }) + '\n');
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
