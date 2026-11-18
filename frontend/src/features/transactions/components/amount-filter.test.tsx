import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { render } from '@/test/render';
import { AmountFilter } from './amount-filter';

test('applies grouped amounts after typing pauses without Apply', async () => {
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
        location_ids: [],
      }}
      baseCurrency="USD"
      onApply={onApply}
    />,
  );
  expect(screen.getByLabelText('From, USD')).toHaveValue('1,500.00');
  await user.type(screen.getByLabelText('To, USD'), '25000,5');
  expect(onApply).not.toHaveBeenCalled();
  await waitFor(() => {
    expect(onApply).toHaveBeenCalledWith(
      { base_currency_amount_from: '1500.00', base_currency_amount_to: '25000.50' },
      undefined,
    );
  });
  expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
});

test('shows an invalid range and leaves applied amounts unchanged', async () => {
  const onApply = vi.fn();
  const user = userEvent.setup();
  render(
    <AmountFilter
      filters={{
        transaction_types: [],
        base_currency_amount_from: '100',
        account_ids: [],
        category_ids: [],
        income_source_ids: [],
        location_ids: [],
      }}
      baseCurrency="USD"
      onApply={onApply}
    />,
  );
  await user.type(screen.getByLabelText('To, USD'), '50');
  expect(
    await screen.findByText('Enter a lower bound no higher than the upper.'),
  ).toBeInTheDocument();
  expect(onApply).not.toHaveBeenCalled();
});
