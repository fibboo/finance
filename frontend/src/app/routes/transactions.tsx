import { useBaseCurrency } from '@/app/use-base-currency';
import { Page } from '@/components/page/page';
import { TransactionFeed } from '@/features/transactions/components/transaction-feed';
import { useTransactionFeed } from '@/features/transactions/hooks/use-transaction-feed';

export function Component() {
  const baseCurrency = useBaseCurrency();
  const feed = useTransactionFeed();
  return (
    <Page title="Transactions" count={feed.query.data?.pages.at(-1)?.total}>
      {baseCurrency !== undefined && (
        <TransactionFeed feed={feed} baseCurrency={baseCurrency} label="Transactions" />
      )}
    </Page>
  );
}
