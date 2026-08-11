import { describe, expect, it } from 'vitest';
import { getNicknameValidationError } from './nicknamePolicy';

describe('nickname policy', () => {
  it('allows ordinary nicknames', () => {
    expect(getNicknameValidationError('풍선친구')).toBeNull();
  });

  it('blocks profanity with repeated characters', () => {
    expect(getNicknameValidationError('시이이발')).not.toBeNull();
  });

  it('blocks sexual terms with inserted punctuation', () => {
    expect(getNicknameValidationError('포.르-노')).not.toBeNull();
  });
});
