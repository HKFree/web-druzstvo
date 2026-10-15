import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import react from '@astrojs/react';
import node from '@astrojs/node';
import basicSsl from '@vitejs/plugin-basic-ssl';

const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');

export default defineConfig({
  security: {
    allowedDomains: [
      { hostname: 'localhost' }, { hostname: '127.0.0.1' }, { hostname: '192.168.5.37' },
      ...(env.DOMAIN ? [{ hostname: env.DOMAIN }] : []),
    ],
  },
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  session: false,
  integrations: [react()],
  vite: {
    plugins: process.env.NODE_ENV === 'development'
      ? [basicSsl({ name: 'hkfree-local', domains: ['192.168.5.37'] })]
      : [],
  },
  trailingSlash: 'ignore',
});
