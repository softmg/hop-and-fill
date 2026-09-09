/** Returns the stable directory prefix used by archive-hosted and embedded builds. */
export function getDirectoryBasename(href = window.location.href) {
  const baseDir = new URL(".", href).pathname;
  const normalized = baseDir.endsWith("/") ? baseDir.slice(0, -1) : baseDir;
  return normalized === "" ? "/" : normalized;
}
