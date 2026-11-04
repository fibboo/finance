import { LOCALE } from '@/lib/format-money';

type IncomeMonth = Readonly<{ value: string; label: string }>;

const EARLIER_MONTH_COUNT = 24;
const MONTH_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function readIncomeMonths({
  isoDate,
  selectedMonth,
}: Readonly<{ isoDate: string; selectedMonth: string }>): readonly IncomeMonth[] {
  const year = Number(isoDate.slice(0, 4));
  const monthIndex = Number(isoDate.slice(5, 7)) - 1;
  const months = Array.from({ length: EARLIER_MONTH_COUNT + 1 }, (_, index) =>
    new Date(Date.UTC(year, monthIndex - index, 1)).toISOString().slice(0, 10),
  );
  const listedMonths = months.includes(selectedMonth) ? months : [selectedMonth, ...months];
  const incomeMonths = listedMonths.map((month) => ({
    value: month,
    label: MONTH_FORMAT.format(new Date(`${month}T00:00:00Z`)),
  }));
  return incomeMonths;
}
