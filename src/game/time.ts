export function formatDurationMs(durationMs: number) {
  const safeMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  const totalTenths = Math.floor(safeMs / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor(totalTenths / 10) % 60;
  const tenths = totalTenths % 10;

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
}
