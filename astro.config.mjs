import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import react from '@astrojs/react';
import node from '@astrojs/node';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { normalizeBasePath } from './src/lib/base-path.mjs';
import { keystaticBase } from './integrations/keystatic-base.mjs';

const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
const base = normalizeBasePath(env.BASE_PATH);

export default defineConfig({
  base: base || '/',
  security: {
    allowedDomains: [
      { hostname: 'localhost' }, { hostname: '127.0.0.1' }, { hostname: '192.168.5.37' },
      ...(env.DOMAIN ? [{ hostname: env.DOMAIN }] : []),
    ],
  },
  output: 'server',
  adapter: node({ mode: 'standalone', bodySizeLimit: 16 * 1024 * 1024 }),
  session: false,
  integrations: [react()],
  vite: {
    // Apply the same adaptation before Vite prebundles the editor in development.
    optimizeDeps: { rolldownOptions: { plugins: [keystaticBase(base)] } },
    plugins: [
      keystaticBase(base),
      ...(process.env.NODE_ENV === 'development' ? [basicSsl({ name: 'hkfree-local', domains: ['192.168.5.37'] })] : []),
    ],
  },
  trailingSlash: 'ignore',
});
