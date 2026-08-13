export function extractAnonymousKey(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const candidate = result as { type?: unknown; hash?: unknown };
  return candidate.type === 'HASH' &&
    typeof candidate.hash === 'string' &&
    candidate.hash.length > 0
    ? candidate.hash
    : null;
}
