import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { readMoneyAccountColor } from '@/lib/account-colors';
import type { components } from '@/lib/api-schema';

import { accountFilterFormSchema } from '../schemas/transaction-filter-forms';
import styles from './account-filter.module.css';
import { FilterActions } from './filter-actions';

type Account = components['schemas']['Account'];
type Location = components['schemas']['Location'];
type AccountFilterFormInput = z.input<typeof accountFilterFormSchema>;

type AccountFilterProps = Readonly<{
  title: string;
  emptyNote: string;
  items: readonly (Account | Location)[];
  itemIds: readonly string[];
  note: string | undefined;
  onApply: (accountIds: string[]) => void;
}>;

export function AccountFilter({
  title,
  emptyNote,
  items,
  itemIds,
  note,
  onApply,
}: AccountFilterProps) {
  const { register, handleSubmit, setValue } = useForm<AccountFilterFormInput>({
    resolver: zodResolver(accountFilterFormSchema),
    defaultValues: { account_ids: [...itemIds] },
  });

  if (items.length === 0) {
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
        {items.map((item) => {
          const color = 'kind' in item ? readMoneyAccountColor(item) : undefined;
          const currency = 'currency' in item ? item.currency : null;
          return (
            <label key={item.id} className={styles['account']}>
              <input
                type="checkbox"
                className={styles['checkbox']}
                value={item.id}
                {...register('account_ids')}
              />
              {color !== undefined && (
                <span className={styles['dot']} style={{ color }} aria-hidden="true" />
              )}
              <span className={styles['name']}>{item.name}</span>
              {currency !== null && <span className={styles['currency']}>{currency}</span>}
            </label>
          );
        })}
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
