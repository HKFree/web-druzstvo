// Keystatic 0.6 has no configurable UI/API prefix. Adapt its client modules at
// build/dev transform time, without mutating node_modules or browser globals.
// Keep the parser guard and browser tests when upgrading @keystatic/core.
export function transformKeystaticPaths(code, base) {
  if (!base) return code;
  const routerPattern = String.raw`/^\/keystatic\/?/`;
  if (code.includes('function RouterProvider(') && !code.includes(routerPattern)) {
    throw new Error('Keystatic router changed: update the BASE_PATH integration before building.');
  }
  const escapedBase = base.replaceAll('/', String.raw`\/`);
  return code
    .replaceAll(routerPattern, `/^${escapedBase}\\/keystatic\\/?/`)
    .replace(/(["'`])\/(api\/)?keystatic(?=[/"'`?])/g, (_match, quote, api = '') => `${quote}${base}/${api}keystatic`);
}

export function keystaticBase(base) {
  return {
    name: 'hkfree-keystatic-base',
    enforce: 'pre',
    transform(code, id) {
      if (!base || !id.replaceAll('\\', '/').includes('/node_modules/@keystatic/core/dist/') || !id.endsWith('.js')) return;
      return { code: transformKeystaticPaths(code, base), map: null };
    },
  };
}
