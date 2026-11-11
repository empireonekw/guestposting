import Link from 'next/link';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20',
  dark: 'bg-ink text-white hover:bg-slate-800',
  secondary: 'bg-white text-ink border border-line hover:bg-canvas hover:border-slate-300',
  ghost: 'text-ink-soft hover:bg-line-soft hover:text-ink',
  danger: 'bg-danger text-white hover:bg-red-700',
};

const SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2',
};

export const buttonClass = ({ variant = 'primary', size = 'md', className = '' } = {}) =>
  `inline-flex items-center justify-center rounded-[var(--radius-control)] font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

// One button for the whole site. Pass `href` to render a link that looks
// like a button.
const Button = ({ variant, size, className, href, loading = false, children, ...props }) => {
  const cls = buttonClass({ variant, size, className });
  if (href) {
    return (
      <Link href={href} className={cls} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" {...props} className={cls} disabled={loading || props.disabled}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
};

export default Button;
