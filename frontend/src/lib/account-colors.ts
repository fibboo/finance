export type AccountColor = Readonly<{ name: string; value: string }>;

export const ACCOUNT_COLORS = [
  { name: 'Blue', value: '#4D8FBF' },
  { name: 'Teal', value: '#2E8C7A' },
  { name: 'Indigo', value: '#5B6CD9' },
  { name: 'Purple', value: '#A15CB8' },
  { name: 'Amber', value: '#B8862C' },
  { name: 'Rust', value: '#C2613F' },
  { name: 'Rose', value: '#C24E6E' },
  { name: 'Olive', value: '#6E8A3A' },
  { name: 'Violet', value: '#8A6FD1' },
  { name: 'Cyan', value: '#2F9BB3' },
  { name: 'Green', value: '#3E9A5C' },
  { name: 'Steel', value: '#4F6D8F' },
  { name: 'Pink', value: '#D07FA8' },
  { name: 'Brown', value: '#9C7A5B' },
  { name: 'Mustard', value: '#C9A227' },
  { name: 'Orange', value: '#D9743A' },
  { name: 'Magenta', value: '#B05C9E' },
  { name: 'Slate', value: '#7A8A99' },
] as const satisfies readonly AccountColor[];

export function readAccountColor(account: Readonly<{ color: string | null }>): string {
  const color = account.color ?? ACCOUNT_COLORS[0].value;
  return color;
}

export function readFreeAccountColors(
  accounts: readonly Readonly<{ color: string | null }>[],
): readonly AccountColor[] {
  const usedColors = new Set(accounts.map((account) => account.color?.toUpperCase()));
  const freeColors = ACCOUNT_COLORS.filter((color) => !usedColors.has(color.value));
  return freeColors;
}
