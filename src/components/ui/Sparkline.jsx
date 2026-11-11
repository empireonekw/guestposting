// A tiny trend line for monthly traffic. Green when the last point is at or
// above the first, red when it fell. Draws nothing with fewer than 2 points.
const Sparkline = ({ values = [], width = 64, height = 20, className = '' }) => {
  const points = values.filter((v) => Number.isFinite(v));
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
    .join(' ');
  const up = points[points.length - 1] >= points[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <path d={d} fill="none" stroke={up ? 'var(--color-success)' : 'var(--color-danger)'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

export default Sparkline;
