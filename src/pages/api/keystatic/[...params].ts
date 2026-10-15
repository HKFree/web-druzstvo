import type { APIRoute } from 'astro';
import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic';
import config from '../../../../keystatic.config';
import { contentStore } from '../../../lib/server/content';

const handler = makeGenericAPIRouteHandler({ config, localBaseDirectory: contentStore.root });
// Both the UI and this API are protected by src/middleware.ts.
export const ALL: APIRoute = async ({ request }) => {
  await contentStore.ready();
  const { body, headers, status } = await handler(request);
  return new Response(body instanceof Uint8Array ? new Uint8Array(body) : body, { headers, status });
};
