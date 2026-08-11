type WindMeterProps = {
  strength: number;
};

export function WindMeter({ strength }: WindMeterProps) {
  const percentage = Math.round(Math.max(0, Math.min(1, strength)) * 100);

  return (
    <div className="wind-meter" aria-label={`바람 세기 ${percentage}%`}>
      <div className="wind-meter__heading">
        <span className="wind-meter__label">바람 세기</span>
        <strong>{percentage}%</strong>
      </div>
      <div className="wind-meter__track" aria-hidden="true">
        <i style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
