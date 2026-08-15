import { describe, expect, it } from 'vitest';
import { getNicknameValidationError } from './nicknamePolicy';

describe('nickname policy', () => {
  it('allows ordinary nicknames', () => {
    expect(getNicknameValidationError('풍선친구')).toBeNull();
  });

  it('allows nicknames from 2 to 6 characters', () => {
    expect(getNicknameValidationError('풍선')).toBeNull();
    expect(getNicknameValidationError('가나다라마바')).toBeNull();
    expect(getNicknameValidationError('풍선King')).toBeNull();
    expect(getNicknameValidationError('풍')).toContain('2~6');
    expect(getNicknameValidationError('가나다라마바사')).toContain('2~6');
  });

  it.each(['풍선 왕', '풍선🎈', '풍선!', 'ㅋㅋ왕', '풍선_왕'])(
    'blocks unsupported characters in %s',
    (nickname) => {
      expect(getNicknameValidationError(nickname)).toBe(
        '별명은 한글, 영문, 숫자만 사용할 수 있어요.',
      );
    },
  );

  it('allows complete Hangul, English letters, and numbers', () => {
    expect(getNicknameValidationError('풍선12')).toBeNull();
    expect(getNicknameValidationError('Ballon')).toBeNull();
    expect(getNicknameValidationError('Ab12가나')).toBeNull();
  });

  it('blocks profanity with repeated characters', () => {
    expect(getNicknameValidationError('시이이발')).not.toBeNull();
  });

  it('blocks sexual terms with inserted punctuation', () => {
    expect(getNicknameValidationError('포.르-노')).not.toBeNull();
  });
});
