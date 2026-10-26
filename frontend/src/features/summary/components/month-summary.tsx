import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { Skeleton } from '@/components/skeleton/skeleton';
import { useToday } from '@/hooks/use-today';
import { formatMoney } from '@/lib/format-money';

import { summaryQueries } from '../api/summary-queries';
import styles from './month-summary.module.css';

type SpendingPace = 'onPace' | 'ahead' | 'over';

type MonthProgress = Readonly<{ spentShare: number; elapsedShare: number; pace: SpendingPace }>;

function readMonthProgress({
  month,
  today,
  earned,
  spent,
  left,
}: Readonly<{
  month: string;
  today: string;
  earned: number;
  spent: number;
  left: number;
}>): MonthProgress {
  const [year = 0, monthNumber = 0] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const elapsedDays =
    today < month
      ? 0
      : today.startsWith(month.slice(0, 7))
        ? Number(today.slice(8, 10))
        : daysInMonth;
  const elapsedShare = elapsedDays / daysInMonth;
  const spentShare = earned > 0 ? Math.min(spent / earned, 1) : Number(spent > 0);
  const pace: SpendingPace = left < 0 ? 'over' : spentShare <= elapsedShare ? 'onPace' : 'ahead';
  const monthProgress = { spentShare, elapsedShare, pace };
  return monthProgress;
}

function readPercent(share: number): string {
  const percent = `${String(Math.round(share * 100))}%`;
  return percent;
}

type MonthSummaryProps = Readonly<{ baseCurrency: string }>;

export function MonthSummary({ baseCurrency }: MonthSummaryProps) {
  const { data: summary, isPending } = useQuery(summaryQueries.current());
  const today = useToday();
  const titleId = useId();
  if (!isPending && summary === undefined) {
    return null;
  }

  if (summary === undefined) {
    return (
      <section className={styles['monthSummary']} aria-labelledby={titleId} aria-busy={isPending}>
        <div className={styles['header']}>
          <h2 id={titleId} className={styles['title']}>
            This month
          </h2>
          <Skeleton className={styles['leftSkeleton']} />
        </div>
        <div className={styles['track']} />
        <div className={styles['legend']}>
          <Skeleton className={styles['legendSkeleton']} />
          <Skeleton className={styles['legendSkeleton']} />
        </div>
      </section>
    );
  }

  const earned = Number(summary.earned);
  const spent = Number(summary.spent);
  const left = Number(summary.left_over);
  const { spentShare, elapsedShare, pace } = readMonthProgress({
    month: summary.month,
    today,
    earned,
    spent,
    left,
  });
  return (
    <section className={styles['monthSummary']} aria-labelledby={titleId} aria-busy={isPending}>
      <div className={styles['header']}>
        <h2 id={titleId} className={styles['title']}>
          This month
        </h2>
        <p className={styles['left']}>
          Left{' '}
          <span className={left < 0 ? styles['danger'] : styles['amount']}>
            {formatMoney({ amount: left, currency: baseCurrency })}
          </span>
        </p>
      </div>
      <div className={styles['track']} aria-hidden="true">
        <div className={styles[pace]} style={{ width: readPercent(spentShare) }} />
        <div className={styles['today']} style={{ left: readPercent(elapsedShare) }} />
      </div>
      <p className="visually-hidden">
        {readPercent(spentShare)} of the earnings spent, {readPercent(elapsedShare)} of the month
        gone
      </p>
      <dl className={styles['legend']}>
        <div className={styles['figure']}>
          <dt>Spent</dt>
          <dd className={styles['amount']}>
            {formatMoney({ amount: -spent, currency: baseCurrency, signDisplay: 'exceptZero' })}
          </dd>
        </div>
        <div className={styles['figure']}>
          <dt>Earned</dt>
          <dd className={earned > 0 ? styles['accent'] : styles['amount']}>
            {formatMoney({ amount: earned, currency: baseCurrency, signDisplay: 'exceptZero' })}
          </dd>
        </div>
      </dl>
    </section>
  );
}
