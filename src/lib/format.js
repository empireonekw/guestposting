// Number and money formatting shared by the publisher list, cards and forms.

export const compact = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e9) return `${+(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${+(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
};

export const money = (n) =>
  `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const hostOf = (url) =>
  String(url || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '');
