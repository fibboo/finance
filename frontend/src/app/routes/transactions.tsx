import { useBaseCurrency } from '@/app/use-base-currency';
import { Page } from '@/components/page/page';
import { TransactionFeed } from '@/features/transactions/components/transaction-feed';

export function Component() {
  const baseCurrency = useBaseCurrency();
  return (
    <Page title="Transactions">
      {baseCurrency !== undefined && <TransactionFeed baseCurrency={baseCurrency} />}
    </Page>
  );
}
