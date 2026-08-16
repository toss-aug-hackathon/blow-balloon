type WindMeterProps = {
  strength: number;
  isEnding?: boolean;
};

export function WindMeter({ strength, isEnding = false }: WindMeterProps) {
  const percentage = Math.round(Math.max(0, Math.min(1, strength)) * 100);

  return (
    <div
      className={`wind-meter${isEnding ? ' wind-meter--ending' : ''}`}
      aria-label={`${isEnding ? '바람 유지' : '바람 세기'} ${percentage}%`}
    >
      <div className="wind-meter__heading">
        <span className="wind-meter__label">
          {isEnding ? '바람 유지' : '바람 세기'}
        </span>
        <strong>{percentage}%</strong>
      </div>
      <div className="wind-meter__track" aria-hidden="true">
        <i style={{ width: `${percentage}%` }} />
      </div>
      <div className="wind-meter__scale" aria-hidden="true">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
