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

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 6;

const NICKNAME_ALLOWED_PATTERN = /^[가-힣A-Za-z0-9]+$/u;

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

  if (length < NICKNAME_MIN_LENGTH || length > NICKNAME_MAX_LENGTH) {
    return '별명은 2~6자로 입력해 주세요.';
  }
  if (!NICKNAME_ALLOWED_PATTERN.test(nickname)) {
    return '별명은 한글, 영문, 숫자만 사용할 수 있어요.';
  }

  const normalized = normalizeNicknameForFilter(nickname);
  if (BLOCKED_NICKNAME_TERMS.some((term) => normalized.includes(term))) {
    return '사용할 수 없는 별명이에요. 다른 별명을 입력해 주세요.';
  }

  return null;
}
