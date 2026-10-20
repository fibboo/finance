export const LOCALE = 'en-US';

export function formatMoney({
  amount,
  currency,
  signDisplay = 'auto',
}: Readonly<{
  amount: number;
  currency: string;
  signDisplay?: Intl.NumberFormatOptions['signDisplay'];
}>): string {
  const money = new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    signDisplay,
  }).format(amount);
  return money;
}
