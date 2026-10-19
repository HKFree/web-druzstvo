import type { APIRoute } from 'astro';
import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic';
import config from '../../../../keystatic.config';
import { validateDocumentUpdates } from '../../../lib/server/documents.mjs';
import { contentStore, documentStore, contactStore } from '../../../lib/server/content';
import { appPath } from '../../../lib/paths';
import { validateNewsUpdates } from '../../../lib/server/storage.mjs';

const handler = makeGenericAPIRouteHandler({ config, localBaseDirectory: contentStore.root });
// Both the UI and this API are protected by src/middleware.ts.
export const ALL: APIRoute = async ({ request }) => {
  await Promise.all([contentStore.ready(), documentStore.ready(), contactStore.ready()]);
  if (request.method === 'POST') {
    let payload;
    try { payload = await request.clone().json(); }
    catch { return new Response('Neplatný požadavek.', { status: 400 }); }
    try { validateNewsUpdates(payload); }
    catch { return new Response('Novinka musí mít platné údaje; u typu Facebook zadejte HTTPS odkaz na facebook.com, fb.com nebo fb.watch.', { status: 400 }); }
    try { await validateDocumentUpdates(payload, contentStore.root); }
    catch { return new Response('Dokument musí mít název, nezáporné pořadí a platný PDF soubor do 10 MB.', { status: 400 }); }
  }
  // The generic Keystatic handler expects its original /api/keystatic URL.
  const url = new URL(request.url);
  url.pathname = appPath(url.pathname) ?? url.pathname;
  const { body, headers, status } = await handler({
    url: url.href, method: request.method, headers: request.headers, json: () => request.json(),
  });
  return new Response(body instanceof Uint8Array ? new Uint8Array(body) : body, { headers, status });
};
