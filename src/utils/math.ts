export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

export function formatSeconds(milliseconds: number): string {
  return (milliseconds / 1000).toFixed(2);
}

export function getContainScale(
  availableWidth: number,
  availableHeight: number,
  contentWidth: number,
  contentHeight: number,
): number {
  if (contentWidth <= 0 || contentHeight <= 0) return 1;
  return Math.min(1, availableWidth / contentWidth, availableHeight / contentHeight);
}
