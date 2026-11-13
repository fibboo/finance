import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { readMoneyAccountColor } from '@/lib/account-colors';
import type { components } from '@/lib/api-schema';

import { itemFilterFormSchema } from '../schemas/transaction-filter-forms';
import { FilterActions } from './filter-actions';
import styles from './item-filter.module.css';

type Account = components['schemas']['Account'];
type Location = components['schemas']['Location'];
type ItemFilterFormInput = z.input<typeof itemFilterFormSchema>;

type ItemFilterProps = Readonly<{
  title: string;
  emptyNote: string;
  items: readonly (Account | Location)[];
  itemIds: readonly string[];
  note: string | undefined;
  onApply: (itemIds: string[]) => void;
}>;

export function ItemFilter({ title, emptyNote, items, itemIds, note, onApply }: ItemFilterProps) {
  const { register, handleSubmit, setValue } = useForm<ItemFilterFormInput>({
    resolver: zodResolver(itemFilterFormSchema),
    defaultValues: {
      item_ids: itemIds.filter((itemId) => items.some((item) => item.id === itemId)),
    },
  });

  if (items.length === 0 && itemIds.length === 0) {
    return <p className={styles['emptyNote']}>{emptyNote}</p>;
  }

  return (
    <form
      className={styles['itemFilter']}
      noValidate
      onSubmit={(event) => {
        void handleSubmit((values) => {
          onApply(values.item_ids);
        })(event);
      }}
    >
      {items.length === 0 ? (
        <p className={styles['emptyNote']}>{emptyNote}</p>
      ) : (
        <fieldset className={styles['items']}>
          <legend className="visually-hidden">{title}</legend>
          {items.map((item) => {
            const color = 'kind' in item ? readMoneyAccountColor(item) : undefined;
            const currency = 'currency' in item ? item.currency : null;
            return (
              <label key={item.id} className={styles['item']}>
                <input
                  type="checkbox"
                  className={styles['checkbox']}
                  value={item.id}
                  {...register('item_ids')}
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
      )}
      {note !== undefined && <p className={styles['note']}>{note}</p>}
      <FilterActions
        onReset={() => {
          setValue('item_ids', []);
        }}
      />
    </form>
  );
}
