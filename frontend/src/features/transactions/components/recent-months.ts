import { LOCALE } from '@/lib/format-money';

type RecentMonth = Readonly<{ label: string; month_end: string }>;

const RECENT_MONTH_COUNT = 3;
const MONTH_FORMAT = new Intl.DateTimeFormat(LOCALE, { month: 'long', timeZone: 'UTC' });

export function readRecentMonths(today: string): readonly RecentMonth[] {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  const recentMonths = Array.from({ length: RECENT_MONTH_COUNT }, (_, index) => {
    const monthEnd = new Date(Date.UTC(year, month - index, 0));
    return { label: MONTH_FORMAT.format(monthEnd), month_end: monthEnd.toISOString().slice(0, 10) };
  });
  return recentMonths;
}
