import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { render } from '@/test/render';
import { AmountFilter } from './amount-filter';

test('keeps calculation drafts private and applies one validated bound', async () => {
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
  await user.click(screen.getByRole('button', { name: 'Calculate upper bound' }));
  expect(screen.getByLabelText('Calculation')).toHaveValue('');
  await user.type(screen.getByLabelText('Calculation'), '100+50');
  await new Promise((resolve) => {
    setTimeout(resolve, 400);
  });
  expect(screen.getByLabelText('To, USD')).toHaveValue('');
  expect(onApply).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Calculate upper bound' }));
  expect(screen.getByLabelText('Calculation')).toHaveValue('');
  await user.type(screen.getByLabelText('Calculation'), '50');
  await user.click(screen.getByRole('button', { name: 'Apply 50.00' }));
  expect(
    await screen.findByText('Enter a lower bound no higher than the upper.'),
  ).toBeInTheDocument();
  expect(onApply).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Calculate upper bound' }));
  await user.clear(screen.getByLabelText('Calculation'));
  await user.type(screen.getByLabelText('Calculation'), '200+50');
  await user.keyboard('{Enter}');
  await waitFor(() => {
    expect(onApply).toHaveBeenCalledExactlyOnceWith(
      { base_currency_amount_from: '100.00', base_currency_amount_to: '250.00' },
      undefined,
    );
  });
  expect(screen.getByLabelText('To, USD')).toHaveValue('250.00');
});

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
