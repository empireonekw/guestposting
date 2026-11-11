import Link from 'next/link';
import LEGAL, { POLICIES, updatedText } from '@/data/legal';

// Shared layout for the policy pages: title, last-updated date, a contents
// list that stays in view on wide screens, and links to the other policies.
//   sections: [{ id, title, body }]  (body is JSX)

export const P = ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>;
export const List = ({ items }) => (
  <ul className="mb-4 list-disc space-y-1.5 pl-5 leading-relaxed marker:text-brand-400">
    {items.map((item, i) => <li key={i}>{item}</li>)}
  </ul>
);
export const A = ({ href, children }) => (
  href.startsWith('/')
    ? <Link href={href} className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-600">{children}</Link>
    : <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-600">{children}</a>
);
export const Mail = ({ to = LEGAL.email }) => <A href={`mailto:${to}`}>{to}</A>;

const LegalPage = ({ path, title, intro, sections }) => (
  <div className="bg-canvas">
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 max-w-3xl">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-brand-700">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
        <p className="mt-3 text-[14px] text-ink-soft">Last updated {updatedText()}</p>
        {intro && <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{intro}</p>}
      </header>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
          <nav aria-label="On this page" className="rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-faint">On this page</p>
            <ol className="space-y-1.5 text-[13px]">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex gap-2 text-ink-soft hover:text-brand-700">
                    <span className="tabular-nums text-ink-faint">{i + 1}.</span> {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <nav aria-label="Other policies" className="mt-4 hidden rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-card)] lg:block">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-faint">Policies</p>
            <ul className="space-y-1.5 text-[13px]">
              {POLICIES.map((p) => (
                <li key={p.href}>
                  {p.href === path
                    ? <span className="font-semibold text-ink">{p.title}</span>
                    : <Link href={p.href} className="text-ink-soft hover:text-brand-700">{p.title}</Link>}
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <article className="min-w-0 rounded-2xl border border-line bg-white px-5 py-6 text-[15px] text-ink-soft shadow-[var(--shadow-card)] sm:px-10 sm:py-10">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 [&:not(:first-child)]:mt-10">
              <h2 className="mb-3 text-xl font-semibold text-ink">{i + 1}. {s.title}</h2>
              {s.body}
            </section>
          ))}
          <div className="mt-12 rounded-xl bg-canvas p-5 text-[14px]">
            <p className="font-semibold text-ink">Questions about this policy?</p>
            <p className="mt-1">Email <Mail /> or see our <A href="/contact">contact page</A>.</p>
          </div>
        </article>
      </div>
    </div>
  </div>
);

export default LegalPage;
