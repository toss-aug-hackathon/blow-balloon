import { describe, expect, it } from 'vitest';
import { extractAnonymousKey } from './anonymousIdentity';

describe('extractAnonymousKey', () => {
  it('extracts a valid non-game anonymous key', () => {
    expect(extractAnonymousKey({ type: 'HASH', hash: 'anonymous-user' }))
      .toBe('anonymous-user');
  });

  it.each([undefined, 'ERROR', 'INVALID_CATEGORY', null, {}, { type: 'HASH', hash: '' }])(
    'returns null for unavailable identity result: %s',
    (result) => {
      expect(extractAnonymousKey(result)).toBeNull();
    },
  );
});
