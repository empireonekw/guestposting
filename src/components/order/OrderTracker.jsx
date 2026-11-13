import { Check } from 'lucide-react';
import { ORDER_STEPS } from '@/data/orderStatus';

// The progress bar at the top of the order page. A step is done when its
// date is set; the first step that isn't done is the current one.

const doneAt = (order, key) => ({
  ordered: order.createdAt,
  accepted: order.acceptedAt,
  brief: order.briefAt,
  draft: order.draftApprovedAt,
  published: order.deliveredAt,
  completed: order.completedAt,
}[key]);

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '');

const OrderTracker = ({ order }) => {
  const steps = ORDER_STEPS.filter((s) => !s.sellerWritesOnly || order.contentSource === 'seller');
  const stopped = order.status === 'cancelled';
  const current = steps.findIndex((s) => !doneAt(order, s.key));

  return (
    <ol className="flex items-start" aria-label="Order progress">
      {steps.map((step, i) => {
        const at = doneAt(order, step.key);
        const done = !!at;
        const active = !stopped && i === current;
        return (
          <li key={step.key} className="relative flex flex-1 flex-col items-center text-center" aria-current={active ? 'step' : undefined}>
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2 ${done ? 'bg-brand-500' : 'bg-line'}`}
              />
            )}
            <span
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[12px] font-semibold ${
                done ? 'border-brand-600 bg-brand-600 text-white'
                  : active ? 'border-brand-600 bg-white text-brand-700'
                    : 'border-line bg-white text-ink-faint'
              }`}
            >
              {done ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`mt-2 px-0.5 text-[11px] font-medium leading-tight sm:text-[12px] ${done || active ? 'text-ink' : 'text-ink-faint'}`}>{step.label}</span>
            <span className="text-[11px] text-ink-faint">{fmt(at)}</span>
          </li>
        );
      })}
    </ol>
  );
};

export default OrderTracker;
