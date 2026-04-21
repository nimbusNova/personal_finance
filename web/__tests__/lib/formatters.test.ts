import { formatCurrency, formatNumber, formatCurrencyPrivate } from '../../lib/formatters';

describe('formatCurrency', () => {
  it('formats number as USD currency', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('handles undefined/null by returning $0.00', () => {
    expect(formatCurrency(undefined as any)).toBe('$0.00');
    expect(formatCurrency(null as any)).toBe('$0.00');
  });

  it('handles negative values', () => {
    expect(formatCurrency(-500)).toBe('-$500.00');
  });

  it('handles large numbers', () => {
    expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
  });
});

describe('formatNumber', () => {
  it('formats number with max 2 decimal places', () => {
    expect(formatNumber(1234.5678)).toBe('1,234.57');
  });

  it('handles whole numbers', () => {
    expect(formatNumber(100)).toBe('100');
  });

  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('handles undefined/null by returning 0', () => {
    expect(formatNumber(undefined as any)).toBe('0');
    expect(formatNumber(null as any)).toBe('0');
  });
});

describe('formatCurrencyPrivate', () => {
  it('returns formatted currency when showAmounts is true', () => {
    expect(formatCurrencyPrivate(1234.56, true)).toBe('$1,234.56');
  });

  it('returns masked value when showAmounts is false', () => {
    expect(formatCurrencyPrivate(1234.56, false)).toBe('****');
  });

  it('returns masked value regardless of amount', () => {
    expect(formatCurrencyPrivate(0, false)).toBe('****');
    expect(formatCurrencyPrivate(999999, false)).toBe('****');
  });
});
