import { describe, expect, it } from 'vitest';
import { extractAnonymousKey } from './anonymousIdentity';

describe('extractAnonymousKey', () => {
  it('extracts a valid non-game anonymous key from HASH object', () => {
    expect(extractAnonymousKey({ type: 'HASH', hash: 'anonymous-user' }))
      .toBe('anonymous-user');
  });

  it('extracts a valid anonymous key from direct string or other object structures', () => {
    expect(extractAnonymousKey('user-hash-12345')).toBe('user-hash-12345');
    expect(extractAnonymousKey({ hash: 'user-hash-67890' })).toBe('user-hash-67890');
    expect(extractAnonymousKey({ userKey: 'user-key-1111' })).toBe('user-key-1111');
    expect(extractAnonymousKey({ data: { hash: 'nested-user-hash' } })).toBe('nested-user-hash');
  });

  it.each([undefined, 'ERROR', 'INVALID_CATEGORY', null, {}, { type: 'HASH', hash: '' }])(
    'returns null for unavailable identity result: %s',
    (result) => {
      expect(extractAnonymousKey(result)).toBeNull();
    },
  );
});
