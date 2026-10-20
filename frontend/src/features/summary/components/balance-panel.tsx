import { useQuery } from '@tanstack/react-query';

import { formatMoney } from '@/lib/format-money';

import { summaryQueries } from '../api/summary-queries';
import styles from './balance-panel.module.css';

type BalancePanelProps = Readonly<{ baseCurrency: string }>;

export function BalancePanel({ baseCurrency }: BalancePanelProps) {
  const { data: summary } = useQuery(summaryQueries.current());
  if (summary === undefined) {
    return null;
  }

  const earned = Number(summary.earned);
  const tiles = [
    { label: 'Earned', amount: earned, isAccent: earned > 0 },
    { label: 'Spent', amount: -Number(summary.spent), isAccent: false },
    { label: 'Left over', amount: Number(summary.left_over), isAccent: false },
  ];
  return (
    <section className={styles['balancePanel']} aria-label="Balance">
      <p className={styles['total']}>
        <span className={styles['totalLabel']}>Total balance · {baseCurrency}</span>
        <span className={styles['totalAmount']}>
          {formatMoney({ amount: Number(summary.total_balance), currency: baseCurrency })}
        </span>
      </p>
      <div className={styles['month']}>
        <span className={styles['monthLabel']}>This month</span>
        <dl className={styles['tiles']}>
          {tiles.map((tile) => (
            <div key={tile.label} className={styles['tile']}>
              <dt className={styles['tileLabel']}>{tile.label}</dt>
              <dd className={tile.isAccent ? styles['tileAccent'] : styles['tileAmount']}>
                {formatMoney({
                  amount: tile.amount,
                  currency: baseCurrency,
                  signDisplay: 'exceptZero',
                })}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
