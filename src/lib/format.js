// Number and money formatting shared by the publisher list, cards and forms.

export const compact = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e9) return `${+(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${+(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
};

// "$150" for whole amounts, "$799.90" otherwise.
export const money = (n) => {
  const v = Number(n) || 0;
  const cents = Number.isInteger(v) ? 0 : 2;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: cents, maximumFractionDigits: cents })}`;
};

export const hostOf = (url) =>
  String(url || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '');
