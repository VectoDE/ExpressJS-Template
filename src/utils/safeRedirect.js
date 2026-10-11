/**
 * Returns `target` only when it is a local path such as `/dashboard?tab=1`.
 * Absolute URLs, protocol-relative URLs (`//evil.example`) and backslash tricks fall back, also when dot segments
 * only produce them after normalisation (`/..//evil.example` becomes `//evil.example`).
 */
const safeRedirect = (target, fallback = '/') => {
  if (typeof target !== 'string' || target.length > 2048) {
    return fallback;
  }
  if (!target.startsWith('/') || target.startsWith('//') || /[\\\s]/.test(target)) {
    return fallback;
  }
  try {
    const url = new URL(target, 'http://localhost');
    const local = `${url.pathname}${url.search}`;
    return url.origin === 'http://localhost' && !local.startsWith('//') ? local : fallback;
  } catch {
    // Anything the URL parser rejects is treated like a foreign target.
    return fallback;
  }
};

module.exports = safeRedirect;
