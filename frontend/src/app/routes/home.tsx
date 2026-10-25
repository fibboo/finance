import { useBaseCurrency } from '@/app/use-base-currency';
import { Page } from '@/components/page/page';
import { AccountList } from '@/features/accounts/components/account-list';
import { BalancePanel } from '@/features/summary/components/balance-panel';
import { RecentTransactions } from '@/features/transactions/components/recent-transactions';

export function Component() {
  const baseCurrency = useBaseCurrency();
  return (
    <Page title="Home">
      {baseCurrency !== undefined && (
        <>
          <BalancePanel baseCurrency={baseCurrency} />
          <AccountList baseCurrency={baseCurrency} />
          <RecentTransactions baseCurrency={baseCurrency} />
        </>
      )}
    </Page>
  );
}
