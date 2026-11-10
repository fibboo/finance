import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { render } from '@/test/render';

import { AmountFilter } from './amount-filter';

test('shows the amounts of the filter grouped and applies typed amounts as plain amounts', async () => {
  // arrange
  const onApply = vi.fn();
  const user = userEvent.setup();
  render(
    <AmountFilter
      filters={{
        transaction_types: [],
        base_currency_amount_from: '1500',
        account_ids: [],
        category_ids: [],
        income_source_ids: [],
      }}
      baseCurrency="USD"
      onApply={onApply}
    />,
  );
  expect(screen.getByLabelText('From, USD')).toHaveValue('1,500.00');
  await user.type(screen.getByLabelText('To, USD'), '25000,5');

  // act
  await user.click(screen.getByRole('button', { name: 'Apply' }));

  // assert
  expect(onApply).toHaveBeenCalledWith(
    { base_currency_amount_from: '1500.00', base_currency_amount_to: '25000.50' },
    expect.anything(),
  );
});
