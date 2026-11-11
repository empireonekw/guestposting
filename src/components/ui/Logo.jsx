import BRAND from '@/data/brand';

// The site logo: the icon plus the two-colour name, as in the brand logo.
// `tone="light"` is for dark backgrounds (the icon sits on a white tile).
// `compact` shows the icon only (collapsed sidebar).
const Logo = ({ tone = 'dark', size = 'md', compact = false, label, className = '' }) => {
  const h = { sm: 26, md: 32, lg: 40 }[size];
  const text = { sm: 'text-[16px]', md: 'text-[19px]', lg: 'text-[24px]' }[size];
  const [first, second] = BRAND.wordmark;
  const light = tone === 'light';
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className={`inline-flex shrink-0 items-center justify-center ${light ? 'rounded-lg bg-white px-1.5 py-1' : ''}`}>
        <img
          src={BRAND.logo.mark}
          alt={compact ? BRAND.name : ''}
          width={Math.round(h * BRAND.logo.markRatio)}
          height={h}
          style={{ height: h, width: 'auto' }}
        />
      </span>
      {!compact && (
        <span className="flex min-w-0 items-baseline gap-2">
          <span className={`whitespace-nowrap font-extrabold uppercase tracking-tight ${text}`}>
            <span style={{ color: light ? '#ffffff' : BRAND.colors.navy }}>{first}</span>{' '}
            <span style={{ color: light ? BRAND.colors.blueLight : BRAND.colors.blue }}>{second}</span>
          </span>
          {label && <span className="truncate border-l border-line pl-2 text-[12px] font-medium normal-case text-ink-faint">{label}</span>}
        </span>
      )}
    </span>
  );
};

export default Logo;
