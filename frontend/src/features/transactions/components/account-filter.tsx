import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { readAccountColor } from '@/lib/account-colors';
import type { components } from '@/lib/api-schema';

import { accountFilterFormSchema } from '../schemas/transaction-filter-forms';
import styles from './account-filter.module.css';
import { FilterActions } from './filter-actions';

type Account = components['schemas']['Account'];
type AccountFilterFormInput = z.input<typeof accountFilterFormSchema>;

type AccountFilterProps = Readonly<{
  title: string;
  emptyNote: string;
  accounts: readonly Account[];
  accountIds: readonly string[];
  note: string | undefined;
  onApply: (accountIds: string[]) => void;
}>;

export function AccountFilter({
  title,
  emptyNote,
  accounts,
  accountIds,
  note,
  onApply,
}: AccountFilterProps) {
  const { register, handleSubmit, setValue } = useForm<AccountFilterFormInput>({
    resolver: zodResolver(accountFilterFormSchema),
    defaultValues: { account_ids: [...accountIds] },
  });

  if (accounts.length === 0) {
    return <p className={styles['emptyNote']}>{emptyNote}</p>;
  }

  return (
    <form
      className={styles['accountFilter']}
      noValidate
      onSubmit={(event) => {
        void handleSubmit((values) => {
          onApply(values.account_ids);
        })(event);
      }}
    >
      <fieldset className={styles['accounts']}>
        <legend className="visually-hidden">{title}</legend>
        {accounts.map((account) => (
          <label key={account.id} className={styles['account']}>
            <input
              type="checkbox"
              className={styles['checkbox']}
              value={account.id}
              {...register('account_ids')}
            />
            <span
              className={styles['dot']}
              style={{ color: readAccountColor(account) }}
              aria-hidden="true"
            />
            <span className={styles['name']}>{account.name}</span>
            {account.currency !== null && (
              <span className={styles['currency']}>{account.currency}</span>
            )}
          </label>
        ))}
      </fieldset>
      {note !== undefined && <p className={styles['note']}>{note}</p>}
      <FilterActions
        onReset={() => {
          setValue('account_ids', []);
        }}
      />
    </form>
  );
}
