export type FormatOptions = {
  compact?: boolean;
  locale?: 'en' | 'bn';
  decimals?: number;
};

/**
 * Shared BDT currency formatter for Commerce Suite Admin.
 * Handles exact and compact notations (K, L, Cr) with Bengali (bn-BD) numeral conversion.
 */
export function formatBDT(
  value: number | string | null | undefined,
  options: FormatOptions = {},
): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return '—';

  const { compact = false, locale = 'en', decimals = 1 } = options;

  if (compact) {
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    let formattedCompact = '';

    if (abs >= 10000000) {
      // 1 Crore = 10,000,000
      const cr = (abs / 10000000).toFixed(decimals);
      formattedCompact = `${cr.replace(/\.0$/, '')}Cr`;
    } else if (abs >= 100000) {
      // 1 Lakh = 100,000
      const l = (abs / 100000).toFixed(decimals);
      formattedCompact = `${l.replace(/\.0$/, '')}L`;
    } else if (abs >= 1000) {
      const k = (abs / 1000).toFixed(decimals);
      formattedCompact = `${k.replace(/\.0$/, '')}K`;
    } else {
      formattedCompact = abs.toLocaleString('en-BD', { maximumFractionDigits: 0 });
    }

    if (locale === 'bn') {
      const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
      formattedCompact = formattedCompact.replace(/\d/g, (d) => bnDigits[Number(d)]);
    }

    return `${sign}৳${formattedCompact}`;
  }

  // Exact formatting with ৳ symbol and two fraction digits
  return new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatExactBDT(
  value: number | string | null | undefined,
  locale: 'en' | 'bn' = 'en',
): string {
  return formatBDT(value, { compact: false, locale });
}

export function formatNumber(
  value: number | string | null | undefined,
  locale: 'en' | 'bn' = 'en',
): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return '—';

  return new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD').format(num);
}
