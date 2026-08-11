const BLOCKED_NICKNAME_TERMS = [
  '시발',
  '시이발',
  '씨발',
  '씨이발',
  'ㅅㅂ',
  '개새끼',
  '개새',
  '새끼',
  '병신',
  '븅신',
  '지랄',
  '존나',
  '좆',
  '씹',
  '섹스',
  '야동',
  '포르노',
  '자지',
  '보지',
  '성기',
  '강간',
  '창녀',
  '걸레',
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'dick',
  'pussy',
  'porn',
  'sex',
] as const;

export function normalizeNicknameForFilter(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}\p{Cf}]+/gu, '')
    .replace(/(.)\1+/gu, '$1');
}

export function getNicknameValidationError(value: string): string | null {
  const nickname = value.trim();
  const length = Array.from(nickname).length;

  if (length < 2 || length > 12) {
    return '별명은 2~12자로 입력해 주세요.';
  }
  if (nickname.includes('#')) {
    return '별명에는 #을 사용할 수 없어요.';
  }
  if (Array.from(nickname).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  })) {
    return '사용할 수 없는 문자가 포함되어 있어요.';
  }

  const normalized = normalizeNicknameForFilter(nickname);
  if (BLOCKED_NICKNAME_TERMS.some((term) => normalized.includes(term))) {
    return '사용할 수 없는 별명이에요. 다른 별명을 입력해 주세요.';
  }

  return null;
}
