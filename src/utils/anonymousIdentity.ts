export function extractAnonymousKey(result: unknown): string | null {
  if (!result) return null;

  if (typeof result === 'string') {
    const trimmed = result.trim();
    if (
      trimmed === '' ||
      trimmed === 'ERROR' ||
      trimmed === 'INVALID_CATEGORY' ||
      trimmed === 'UNDEFINED' ||
      trimmed === 'null'
    ) {
      return null;
    }
    return trimmed;
  }

  if (typeof result === 'object') {
    const candidate = result as Record<string, unknown>;

    if (typeof candidate.hash === 'string' && candidate.hash.trim().length > 0) {
      return candidate.hash.trim();
    }
    if (typeof candidate.key === 'string' && candidate.key.trim().length > 0) {
      return candidate.key.trim();
    }
    if (typeof candidate.userKey === 'string' && candidate.userKey.trim().length > 0) {
      return candidate.userKey.trim();
    }
    if (typeof candidate.anonymousKey === 'string' && candidate.anonymousKey.trim().length > 0) {
      return candidate.anonymousKey.trim();
    }

    if (candidate.data) {
      const nested = extractAnonymousKey(candidate.data);
      if (nested) return nested;
    }
    if (candidate.result) {
      const nested = extractAnonymousKey(candidate.result);
      if (nested) return nested;
    }
  }

  return null;
}
