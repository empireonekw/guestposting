// Form controls with one shared look. `Field` adds the label, hint and error.

const control =
  'w-full rounded-[var(--radius-control)] border bg-white px-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:outline-none focus:ring-4';
const tone = (error) =>
  error ? 'border-red-300 focus:border-danger focus:ring-red-500/10' : 'border-line focus:border-brand-500 focus:ring-brand-500/10';

export const Field = ({ label, hint, error, htmlFor, required, className = '', children }) => (
  <div className={`space-y-1.5 ${className}`}>
    {label && (
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
    )}
    {children}
    {error ? (
      <p className="text-[12px] font-medium text-danger">{error}</p>
    ) : (
      hint && <p className="text-[12px] text-ink-faint">{hint}</p>
    )}
  </div>
);

export const Input = ({ error, prefix, className = '', ...props }) =>
  prefix ? (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">{prefix}</span>
      <input className={`${control} ${tone(error)} h-10 pl-7 ${className}`} aria-invalid={!!error} {...props} />
    </div>
  ) : (
    <input className={`${control} ${tone(error)} h-10 ${className}`} aria-invalid={!!error} {...props} />
  );

export const Select = ({ error, className = '', children, ...props }) => (
  <select className={`${control} ${tone(error)} h-10 cursor-pointer pr-8 ${className}`} aria-invalid={!!error} {...props}>
    {children}
  </select>
);

export const Textarea = ({ error, className = '', ...props }) => (
  <textarea className={`${control} ${tone(error)} min-h-24 py-2 ${className}`} aria-invalid={!!error} {...props} />
);

export const Checkbox = ({ label, description, className = '', ...props }) => (
  <label className={`flex cursor-pointer items-start gap-2.5 ${className}`}>
    <input type="checkbox" className="mt-0.5 h-4 w-4 cursor-pointer rounded border-line accent-brand-600" {...props} />
    <span>
      <span className="block text-sm text-ink">{label}</span>
      {description && <span className="block text-[12px] text-ink-faint">{description}</span>}
    </span>
  </label>
);
