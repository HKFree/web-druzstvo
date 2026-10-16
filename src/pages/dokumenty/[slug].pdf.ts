import type { APIRoute } from 'astro';
import { documentStore } from '../../lib/server/content';

export const GET: APIRoute = async ({ params }) => {
  const document = await documentStore.publishedFile(params.slug ?? '');
  if (!document) return new Response('Dokument nebyl nalezen.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(new Uint8Array(document.bytes), { headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${document.id}.pdf"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
};
