import type { APIRoute } from 'astro';
import { sitePath } from '../lib/paths';

export const GET: APIRoute = ({ redirect }) => redirect(sitePath('/keystatic'), 302);
