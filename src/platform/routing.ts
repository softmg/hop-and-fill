/** Returns the stable directory prefix used by archive-hosted builds. */
export function getDirectoryBasename(href = window.location.href) {
  const baseDir = new URL(".", href).pathname;
  const normalized = baseDir.endsWith("/") ? baseDir.slice(0, -1) : baseDir;
  return normalized === "" ? "/" : normalized;
}

/**
 * Returns the router basename for the embedded web build.
 *
 * Derived from the base path configured at build time rather than from the
 * current location: a visitor who omits the trailing slash would otherwise
 * make `/games/hop-and-fill` resolve to `/games`, and every route would fall
 * through to the catch-all page. The hosting nginx redirects such requests,
 * but the router must not depend on that.
 */
export function getConfiguredBasename(base = import.meta.env.BASE_URL) {
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  return normalized === "" ? "/" : normalized;
}
