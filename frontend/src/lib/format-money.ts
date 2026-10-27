export const LOCALE = 'en-US';

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
    signDisplay,
    trailingZeroDisplay,
  }).format(amount);
  return money;
}
