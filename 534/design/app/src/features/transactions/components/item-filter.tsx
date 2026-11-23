import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { readMoneyAccountColor } from '@/lib/account-colors';
import type { components } from '@/lib/api-schema';
import { SearchField } from '@/components/search-field/search-field';

import { itemFilterFormSchema } from '../schemas/transaction-filter-forms';
import styles from './item-filter.module.css';

type ItemFilterProps = Readonly<{
  title: string;
  emptyNote: string;
  items: readonly (components['schemas']['Account'] | components['schemas']['Location'])[];
  itemIds: readonly string[];
  note: string | undefined;
  onApply: (itemIds: string[]) => void;
}>;

export function ItemFilter({ title, emptyNote, items, itemIds, note, onApply }: ItemFilterProps) {
  const [search, setSearch] = useState('');
  const { register, handleSubmit } = useForm<z.input<typeof itemFilterFormSchema>>({
    resolver: zodResolver(itemFilterFormSchema),
    values: { item_ids: [...itemIds] },
  });
  const matchingItems = items.filter((item) =>
    item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <form
      className={styles['itemFilter']}
      noValidate
      onChange={(event) => {
        if (!(event.target instanceof HTMLInputElement) || event.target.type !== 'checkbox') {
          return;
        }
        void handleSubmit((values) => {
          onApply(values.item_ids);
        })();
      }}
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <SearchField
        id="filter-item-search"
        label={`Search ${title.toLowerCase()}`}
        term={search}
        isFocusedOnMount={true}
        onSearch={setSearch}
      />
      {items.length === 0 ? (
        <p className={styles['emptyNote']}>{emptyNote}</p>
      ) : matchingItems.length === 0 ? (
        <p className={styles['emptyNote']}>No matches.</p>
      ) : (
        <fieldset className={styles['items']}>
          <legend className="visually-hidden">{title}</legend>
          {matchingItems.map((item) => {
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
    </form>
  );
}
