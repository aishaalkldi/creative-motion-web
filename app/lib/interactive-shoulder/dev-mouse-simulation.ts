/**
 * Development-only mouse simulation for target interaction testing.
 * Never available in production builds.
 */

export function isDevMouseSimulationEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export function normalizedPointFromMouseEvent(
  event: { clientX: number; clientY: number },
  container: DOMRect,
): { x: number; y: number } | null {
  if (!container.width || !container.height) return null;
  const x = (event.clientX - container.left) / container.width;
  const y = (event.clientY - container.top) / container.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}
