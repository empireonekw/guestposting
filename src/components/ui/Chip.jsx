import { X } from 'lucide-react';

// An active filter. Without onRemove it is shown as fixed (a page's own filter).
const Chip = ({ children, onRemove, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 py-1 pl-3 ${onRemove ? 'pr-1' : 'pr-3'} text-[13px] font-medium text-brand-800 ${className}`}
  >
    {children}
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove filter"
        className="flex h-5 w-5 items-center justify-center rounded-full text-brand-600 hover:bg-brand-100"
      >
        <X size={13} />
      </button>
    )}
  </span>
);

export default Chip;
