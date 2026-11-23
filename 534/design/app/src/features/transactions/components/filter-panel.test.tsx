import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { render } from '@/test/render';
import { AmountCalculator } from '@/components/amount-calculator/amount-calculator';
import { FilterPanel } from './filter-panel';

test('keeps the filter open while interacting with and dismissing its calculator', async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  const onApply = vi.fn();
  render(
    <FilterPanel count={0} isOpen onOpenChange={onOpenChange}>
      {() => <AmountCalculator label="upper bound" value="100" currency="USD" onApply={onApply} />}
    </FilterPanel>,
  );
  await user.click(screen.getByRole('button', { name: 'Calculate upper bound' }));
  await user.click(screen.getByRole('button', { name: '2' }));
  expect(screen.getByLabelText('Calculation')).toHaveValue('1,002');
  expect(onOpenChange).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog', { name: 'Calculate upper bound' })).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Filters' })).toBeVisible();
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(onApply).not.toHaveBeenCalled();
});

test('shows one badge and opens Filters with its accessible name', async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  render(
    <FilterPanel count={3} isOpen={false} onOpenChange={onOpenChange}>
      {() => <p>Choices</p>}
    </FilterPanel>,
  );
  expect(screen.getByRole('button', { name: 'Filters' })).toHaveTextContent('3');
  await user.click(screen.getByRole('button', { name: 'Filters' }));
  expect(onOpenChange).toHaveBeenCalledWith(true);
});

test('waits for release outside and returns focus on Escape', async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  render(
    <>
      <FilterPanel count={0} isOpen={true} onOpenChange={onOpenChange}>
        {() => <p>Choices</p>}
      </FilterPanel>
      <p>Transactions</p>
    </>,
  );
  expect(screen.getByRole('dialog', { name: 'Filters' })).toHaveFocus();
  await user.pointer({ keys: '[TouchA>]', target: screen.getByText('Transactions') });
  expect(onOpenChange).not.toHaveBeenCalled();
  await user.pointer({ keys: '[/TouchA]', target: screen.getByText('Transactions') });
  expect(onOpenChange).toHaveBeenCalledWith(false);
  await user.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: 'Filters' })).toHaveFocus();
});
