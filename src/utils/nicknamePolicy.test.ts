import { describe, expect, it } from 'vitest';
import { getNicknameValidationError } from './nicknamePolicy';

describe('nickname policy', () => {
  it('allows ordinary nicknames', () => {
    expect(getNicknameValidationError('풍선친구')).toBeNull();
  });

  it('allows nicknames up to 15 characters', () => {
    expect(getNicknameValidationError('가나다라마바사아자차카타파하')).toBeNull();
    expect(getNicknameValidationError('가나다라마바사아자차카타파하거너')).toContain('2~15');
  });

  it('blocks profanity with repeated characters', () => {
    expect(getNicknameValidationError('시이이발')).not.toBeNull();
  });

  it('blocks sexual terms with inserted punctuation', () => {
    expect(getNicknameValidationError('포.르-노')).not.toBeNull();
  });
});
