type WindMeterProps = {
  strength: number;
};

export function WindMeter({ strength }: WindMeterProps) {
  const activeBars = Math.round(strength * 5);
  return (
    <div className="wind-meter" aria-label={`바람 세기 ${activeBars}/5`}>
      <span className="wind-meter__label">바람 세기</span>
      <div className="wind-meter__bars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((bar) => (
          <i
            key={bar}
            className={bar <= activeBars ? 'is-active' : undefined}
          />
        ))}
      </div>
    </div>
  );
}
