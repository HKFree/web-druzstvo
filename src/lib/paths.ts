import { normalizeBasePath, prefixPath, stripBasePath } from './base-path.mjs';

export const basePath = normalizeBasePath(import.meta.env.BASE_URL);
export const sitePath = (path: string) => prefixPath(path, basePath);
export const appPath = (path: string) => stripBasePath(path, basePath);
