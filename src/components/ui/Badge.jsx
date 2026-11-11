const TONES = {
  neutral: 'bg-line-soft text-ink-soft',
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
};

const Badge = ({ tone = 'neutral', className = '', children, ...props }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-4 ${TONES[tone]} ${className}`}
    {...props}
  >
    {children}
  </span>
);

export default Badge;
