export function normalizeBasePath(value = '') {
  if (value === '' || value === '/') return '';
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\/?$/.test(value)) {
    throw new Error('BASE_PATH musí být cesta jako /v2 nebo /test/v2; pro kořen použijte /.');
  }
  return value.replace(/\/$/, '');
}

// Content keeps root-relative paths so changing deployment prefix needs no migration.
export function prefixPath(path, base = '') {
  if (!base || !path.startsWith('/') || path.startsWith('//')) return path;
  if (path === base || path.startsWith(base + '/') || path.startsWith(base + '?') || path.startsWith(base + '#')) return path;
  return base + path;
}

export function stripBasePath(path, base = '') {
  if (!base) return path;
  if (path === base) return '/';
  return path.startsWith(base + '/') ? path.slice(base.length) : undefined;
}
