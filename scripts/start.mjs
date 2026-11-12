import { fileURLToPath, pathToFileURL } from 'node:url';
import { rmSync } from 'node:fs';
import { prepareRuntime } from './runtime-config.mjs';

let runtime;
try {
  runtime = await prepareRuntime(fileURLToPath(new URL('../dist/', import.meta.url)));
  process.on('exit', () => rmSync(runtime.root, { recursive: true, force: true }));
  await import(pathToFileURL(runtime.entrypoint).href);
  process.once('SIGTERM', () => process.exit(0));
  process.once('SIGINT', () => process.exit(0));
  console.log(`Runtime konfigurace: DOMAIN=${runtime.domain}, BASE_PATH=${runtime.base || '/'}`);
} catch (error) {
  console.error(`Spuštění aplikace selhalo: ${error.message}`);
  process.exitCode = 1;
}
