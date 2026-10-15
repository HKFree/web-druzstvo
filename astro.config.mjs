import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import node from '@astrojs/node';
import keystatic from '@keystatic/astro';

const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
const githubEditor = env.PUBLIC_KEYSTATIC_STORAGE === 'github';

export default defineConfig({
  output: githubEditor ? 'server' : 'static',
  adapter: githubEditor ? node({ mode: 'standalone' }) : undefined,
  integrations: [
    react(), markdoc(),
    ...(process.env.NODE_ENV === 'development' || githubEditor ? [keystatic()] : []),
  ],
  // Keystatic requests API URLs without a trailing slash.
  trailingSlash: 'ignore',
});
