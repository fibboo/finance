export const LOCALE = 'en-US';

const AMOUNT_FRACTION_DIGITS = 2;

export function formatMoney({
  amount,
  currency,
  signDisplay = 'auto',
  trailingZeroDisplay = 'auto',
}: Readonly<{
  amount: number;
  currency: string;
  signDisplay?: Intl.NumberFormatOptions['signDisplay'];
  trailingZeroDisplay?: Intl.NumberFormatOptions['trailingZeroDisplay'];
}>): string {
  const money = new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: AMOUNT_FRACTION_DIGITS,
    maximumFractionDigits: AMOUNT_FRACTION_DIGITS,
    signDisplay,
    trailingZeroDisplay,
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
