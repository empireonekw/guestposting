'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// A button that opens a panel under it (used by the filter bar). Closes on
// Escape and on a click outside. `children` may be a function that receives
// close() so the panel can close itself after "Apply".
const Popover = ({ label, active = false, disabled = false, align = 'left', width = 'sm:w-72', children }) => {
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border px-3 text-[13px] font-medium transition-colors disabled:opacity-50 ${
          active
            ? 'border-brand-300 bg-brand-50 text-brand-800'
            : 'border-line bg-white text-ink-soft hover:border-slate-300 hover:text-ink'
        }`}
      >
        {label}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        // On phones the panel is a sheet at the bottom of the screen so it
        // never runs off the side.
        <div
          className={`z-40 rounded-xl border border-line bg-white p-3 shadow-[var(--shadow-pop)] max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:max-h-[70vh] max-sm:overflow-y-auto sm:absolute sm:top-[calc(100%+6px)] ${align === 'right' ? 'sm:right-0' : 'sm:left-0'} ${width}`}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
};

export default Popover;
