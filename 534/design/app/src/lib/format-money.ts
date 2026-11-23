export const LOCALE = 'en-US';

export const AMOUNT_DECIMAL_DIGITS = 2;

export function formatMoney({
  amount,
  currency,
  signDisplay = 'auto',
  trailingZeroDisplay = 'auto',
  maximumSignificantDigits,
}: Readonly<{
  amount: number;
  currency: string;
  signDisplay?: Intl.NumberFormatOptions['signDisplay'];
  trailingZeroDisplay?: Intl.NumberFormatOptions['trailingZeroDisplay'];
  maximumSignificantDigits?: Intl.NumberFormatOptions['maximumSignificantDigits'];
}>): string {
  const money = new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: AMOUNT_DECIMAL_DIGITS,
    maximumFractionDigits: AMOUNT_DECIMAL_DIGITS,
    signDisplay,
    trailingZeroDisplay,
    maximumSignificantDigits,
  }).format(amount);
  return money;
}

const RATE_FORMAT = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

export function formatRate(rate: number): string {
  const rateText = RATE_FORMAT.format(rate);
  return rateText;
}
