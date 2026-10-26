import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { Skeleton } from '@/components/skeleton/skeleton';
import { formatMoney } from '@/lib/format-money';

import { summaryQueries } from '../api/summary-queries';
import styles from './month-summary.module.css';

type MonthSummaryProps = Readonly<{ baseCurrency: string }>;

export function MonthSummary({ baseCurrency }: MonthSummaryProps) {
  const { data: summary, isPending } = useQuery(summaryQueries.current());
  const titleId = useId();
  if (!isPending && summary === undefined) {
    return null;
  }

  const earned = Number(summary?.earned);
  const left = Number(summary?.left_over);
  const figures = [
    {
      label: 'Earned',
      amount: earned,
      signDisplay: 'exceptZero',
      className: earned > 0 ? styles['accent'] : styles['amount'],
    },
    {
      label: 'Spent',
      amount: -Number(summary?.spent),
      signDisplay: 'exceptZero',
      className: styles['amount'],
    },
    {
      label: 'Left',
      amount: left,
      signDisplay: 'auto',
      className: left < 0 ? styles['danger'] : styles['amount'],
    },
  ] as const;
  return (
    <section className={styles['monthSummary']} aria-labelledby={titleId} aria-busy={isPending}>
      <h2 id={titleId} className={styles['title']}>
        This month
      </h2>
      {summary === undefined ? (
        <div className={styles['figures']}>
          {figures.map((figure) => (
            <div key={figure.label} className={styles['figure']}>
              <Skeleton className={styles['labelSkeleton']} />
              <Skeleton className={styles['amountSkeleton']} />
            </div>
          ))}
        </div>
      ) : (
        <dl className={styles['figures']}>
          {figures.map((figure) => (
            <div key={figure.label} className={styles['figure']}>
              <dt className={styles['label']}>{figure.label}</dt>
              <dd className={figure.className}>
                {formatMoney({
                  amount: figure.amount,
                  currency: baseCurrency,
                  signDisplay: figure.signDisplay,
                })}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
