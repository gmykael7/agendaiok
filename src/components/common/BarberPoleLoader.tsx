interface BarberPoleLoaderProps {
  compact?: boolean;
  className?: string;
}

export function BarberPoleLoader({ compact = false, className = '' }: BarberPoleLoaderProps) {
  return (
    <div
      aria-hidden="true"
      className={`barber-pole-loader${compact ? ' barber-pole-loader--compact' : ''} ${className}`.trim()}
    >
      <div className="barber-pole-loader__figure">
        <div className="barber-pole-loader__ball" />
        <div className="barber-pole-loader__end-cap" />
        <div className="barber-pole-loader__cap" />
        <div className="barber-pole-loader__wrap">
          <div className="barber-pole-loader__barber" />
        </div>
        <div className="barber-pole-loader__cap" />
        <div className="barber-pole-loader__end-cap" />
        <div className="barber-pole-loader__ball" />
      </div>
    </div>
  );
}
