export function formatCurrency(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
}

export function formatNumber(val: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(val || 0);
}

export function formatCurrencyPrivate(val: number, showAmounts: boolean) {
  if (!showAmounts) return '****';
  return formatCurrency(val);
}
