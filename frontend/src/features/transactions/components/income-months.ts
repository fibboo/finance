import { LOCALE } from '@/lib/format-money';

import { readPreviousMonth } from '../schemas/transaction-form';

type IncomeMonth = Readonly<{ value: string; label: string }>;

const EARLIER_MONTH_COUNT = 24;
const MONTH_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function toIncomeMonth({
  month,
  selectedMonth,
  followedMonth,
}: Readonly<{ month: string; selectedMonth: string; followedMonth: string }>): IncomeMonth {
  const incomeMonth = {
    value: month === followedMonth && month !== selectedMonth ? '' : month,
    label: MONTH_FORMAT.format(new Date(`${month}T00:00:00Z`)),
  };
  return incomeMonth;
}

export function readIncomeMonths({
  isoDate,
  selectedMonth,
}: Readonly<{ isoDate: string; selectedMonth: string }>): readonly IncomeMonth[] {
  const year = Number(isoDate.slice(0, 4));
  const monthIndex = Number(isoDate.slice(5, 7)) - 1;
  const followedMonth = readPreviousMonth(isoDate);
  const months = Array.from({ length: EARLIER_MONTH_COUNT + 1 }, (_, index) =>
    new Date(Date.UTC(year, monthIndex - index, 1)).toISOString().slice(0, 10),
  );
  const listedMonths =
    selectedMonth === '' || months.includes(selectedMonth) ? months : [selectedMonth, ...months];
  const incomeMonths = listedMonths.map((month) =>
    toIncomeMonth({ month, selectedMonth, followedMonth }),
  );
  return incomeMonths;
}
