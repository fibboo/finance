import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useBaseCurrency } from '@/app/use-base-currency';
import { Page } from '@/components/page/page';
import { Sheet } from '@/components/sheet/sheet';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import { AccountGroups } from '@/features/accounts/components/account-groups';
import { MoneyAccountForm } from '@/features/accounts/components/money-account-form';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';

import styles from './accounts.module.css';

const NEW_ACCOUNT_ICON_PATH = 'M12 5v14M5 12h14';

function readAccountCount(
  total: number | undefined,
): Readonly<{ value: number; label: string }> | undefined {
  const accountCount =
    total === undefined ? undefined : { value: total, label: total === 1 ? 'account' : 'accounts' };
  return accountCount;
}

export function Component() {
  const baseCurrency = useBaseCurrency();
  const [isCreating, setIsCreating] = useState(false);
  const { data: accountPage } = useQuery({
    ...accountQueries.list({ size: ACCOUNT_PAGE_SIZE, kinds: [...MONEY_ACCOUNT_KINDS] }),
    throwOnError: true,
  });
  const { data: dictionaries } = useQuery({
    ...dictionaryQueries.accounting(),
    throwOnError: true,
  });

  function closeForm() {
    setIsCreating(false);
  }

  return (
    <Page title="Accounts" count={readAccountCount(accountPage?.total)}>
      <div className={styles['actions']}>
        <button
          type="button"
          className={styles['newAccount']}
          disabled={dictionaries === undefined || baseCurrency === undefined}
          onClick={() => {
            setIsCreating(true);
          }}
        >
          <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={NEW_ACCOUNT_ICON_PATH} />
          </svg>
          New <span className="visually-hidden-on-phone">account</span>
        </button>
      </div>
      {baseCurrency !== undefined && (
        <div className={styles['accounts']}>
          <AccountGroups accounts={accountPage?.items} baseCurrency={baseCurrency} />
        </div>
      )}
      {isCreating && dictionaries !== undefined && baseCurrency !== undefined && (
        <Sheet label="New account" onClose={closeForm}>
          <MoneyAccountForm
            name=""
            accountKinds={dictionaries.account_kinds}
            currencies={dictionaries.currencies}
            baseCurrency={baseCurrency}
            onCreated={closeForm}
            onBack={closeForm}
          />
        </Sheet>
      )}
    </Page>
  );
}
