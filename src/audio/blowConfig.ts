export const BLOW_CONFIG = {
  // 주변 소음 기준값을 수집하는 시간(ms)
  calibrationMs: 850,
  // 시작 임계값을 넘긴 상태가 이 시간(ms) 이상 지속되어야 불기로 인정
  startHoldMs: 100,
  // 신호가 약해져도 같은 호흡으로 유지하는 유예 시간(ms)
  endGraceMs: 500,
  // 바람 세기 보정 비율(0~1): 높을수록 입력 변화에 빠르게 반응
  smoothingFactor: 0.18,
  // 주변이 조용해도 불기 시작에 필요한 최소 RMS 음량
  minimumStartThreshold: 0.018,
  // 불기 종료 여부를 판단하는 최소 RMS 음량
  minimumEndThreshold: 0.010,
  // 시작 임계값에 적용할 주변 소음 배수
  baselineStartMultiplier: 3.2,
  // 종료 임계값에 적용할 주변 소음 배수
  baselineEndMultiplier: 1.8,
  // 시작 임계값을 바람 세기 1로 환산할 때 사용하는 입력 범위 배수
  normalizationRangeMultiplier: 10,
  // 전체 0.2~8kHz 에너지 중 2~8kHz가 차지해야 하는 최소 비율
  minimumBreathiness: 0.14,
  // React 화면에 마이크 상태를 반영하는 간격(ms)
  uiUpdateIntervalMs: 50,
} as const;
