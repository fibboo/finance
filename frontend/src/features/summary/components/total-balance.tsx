import { useQuery } from '@tanstack/react-query';

import { EstimatedAmount } from '@/components/estimated-amount/estimated-amount';
import { Skeleton } from '@/components/skeleton/skeleton';
import { formatMoney } from '@/lib/format-money';

import { summaryQueries } from '../api/summary-queries';
import styles from './total-balance.module.css';

const MIN_TWO_DECIMAL_RATE = 0.01;
const SMALL_RATE_SIGNIFICANT_DIGITS = 15;

type TotalBalanceProps = Readonly<{ baseCurrency: string }>;

export function TotalBalance({ baseCurrency }: TotalBalanceProps) {
  const { data: summary, isPending } = useQuery(summaryQueries.current());
  if (!isPending && summary === undefined) {
    return null;
  }

  const estimateRates = summary?.estimate_rates ?? [];
  return summary === undefined ? (
    <p className={styles['totalBalanceSkeleton']}>
      <Skeleton className={styles['labelSkeleton']} />
      <Skeleton className={styles['amountSkeleton']} />
    </p>
  ) : (
    <div className={styles['balanceWithRates']}>
      <p className={styles['totalBalance']}>
        <span className={styles['label']}>Total balance · {baseCurrency}</span>
        {summary.estimated_total_balance === null ? (
          <span className={styles['amount']}>
            {formatMoney({ amount: Number(summary.total_balance), currency: baseCurrency })}
          </span>
        ) : (
          <span className={styles['amount']}>
            <EstimatedAmount
              amount={Number(summary.estimated_total_balance)}
              currency={baseCurrency}
              isMuted={false}
            />
          </span>
        )}
      </p>
      {estimateRates.length > 0 && (
        <div className={styles['rates']}>
          <ul className={styles['rateList']} aria-label="Applied exchange rates">
            {estimateRates.map(({ currency, rate }) => {
              const amount = Number(rate);
              const rateText = formatMoney({
                amount,
                currency: baseCurrency,
                maximumSignificantDigits:
                  amount > 0 && amount < MIN_TWO_DECIMAL_RATE
                    ? SMALL_RATE_SIGNIFICANT_DIGITS
                    : undefined,
              });
              return (
                <li key={currency}>
                  1 {currency} = {rateText}
                </li>
              );
            })}
          </ul>
          <a
            className={styles['rateSource']}
            href="https://www.exchangerate-api.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="ExchangeRate-API (opens in a new tab)"
          >
            ExchangeRate-API
          </a>
        </div>
      )}
    </div>
  );
}
