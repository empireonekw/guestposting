// A country flag from the bundled flag-icons SVGs. `code` is ISO 3166-1
// alpha-2 ("us", "gb"); `name` is read by screen readers and shown on hover.
const Flag = ({ code, name, className = '' }) => {
  const c = String(code || '').toLowerCase();
  if (!/^[a-z]{2}$/.test(c)) return null;
  return <span className={`fi fi-${c} ${className}`} role="img" aria-label={name || c.toUpperCase()} title={name || c.toUpperCase()} />;
};

export default Flag;
