import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import node from '@astrojs/node';
import keystatic from '@keystatic/astro';
import basicSsl from '@vitejs/plugin-basic-ssl';

const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
const githubEditor = env.PUBLIC_KEYSTATIC_STORAGE === 'github';

export default defineConfig({
  output: githubEditor ? 'server' : 'static',
  adapter: githubEditor ? node({ mode: 'standalone' }) : undefined,
  integrations: [
    react(), markdoc(),
    ...(process.env.NODE_ENV === 'development' || githubEditor ? [keystatic()] : []),
  ],
  // LAN editing needs a secure browser context for Keystatic's Web Crypto calls.
  // Certificates are cached under ignored node_modules; production uses its host's TLS.
  vite: {
    plugins: process.env.NODE_ENV === 'development'
      ? [basicSsl({ name: 'hkfree-local', domains: ['192.168.5.37'] })]
      : [],
  },
  // Keystatic requests API URLs without a trailing slash.
  trailingSlash: 'ignore',
});
