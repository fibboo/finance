export const ACCOUNT_COLORS = [
  '#4D8FBF',
  '#2E8C7A',
  '#5B6CD9',
  '#A15CB8',
  '#B8862C',
  '#C2613F',
  '#C24E6E',
  '#6E8A3A',
  '#8A6FD1',
] as const;

export function readAccountColor(account: Readonly<{ color: string | null }>): string {
  const color = account.color ?? ACCOUNT_COLORS[0];
  return color;
}
