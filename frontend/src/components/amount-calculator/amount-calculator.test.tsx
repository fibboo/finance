import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import type { SubmitEventHandler } from 'react';

import { render } from '@/test/render';
import { Sheet } from '@/components/sheet/sheet';

import { AmountCalculator } from './amount-calculator';

test.each(['Escape', 'swipe', 'backdrop'])(
  'closes only the nested calculator with %s and preserves the transaction',
  async (dismissal) => {
    const user = userEvent.setup();
    const onCloseTransaction = vi.fn();
    const onApply = vi.fn();
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600);
    render(
      <Sheet label="New transaction" onClose={onCloseTransaction}>
        <input aria-label="Comment" defaultValue="Unsaved transaction" />
        <AmountCalculator label="amount" value="12.00" currency="USD" onApply={onApply} />
      </Sheet>,
    );
    const trigger = screen.getByRole('button', { name: 'Calculate amount' });
    await user.click(trigger);
    if (dismissal === 'Escape') await user.keyboard('{Escape}');
    else if (dismissal === 'backdrop')
      await user.click(screen.getByRole('dialog', { name: 'Calculate amount' }));
    else {
      await user.pointer({
        keys: '[TouchA>]',
        target: screen.getByRole('heading', { name: 'Calculate amount' }),
        coords: { clientY: 100 },
      });
      await user.pointer({ pointerName: 'TouchA', coords: { clientY: 500 } });
      await user.pointer({ keys: '[/TouchA]' });
    }
    expect(screen.queryByRole('dialog', { name: 'Calculate amount' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'New transaction' })).toBeVisible();
    expect(screen.getByLabelText('Comment')).toHaveValue('Unsaved transaction');
    expect(onCloseTransaction).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
    height.mockRestore();
  },
);

test('negates the whole calculation and restores its grouping', async () => {
  const user = userEvent.setup();
  render(
    <AmountCalculator label="amount" value="" currency="USD" isNegativeAllowed onApply={vi.fn()} />,
  );
  await user.click(screen.getByRole('button', { name: 'Calculate amount' }));
  await user.type(screen.getByLabelText('Calculation'), '-(1)+(2)');
  await user.click(screen.getByRole('button', { name: 'Change sign' }));
  expect(screen.getByRole('button', { name: 'Apply -1.00' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Change sign' }));
  expect(screen.getByLabelText('Calculation')).toHaveValue('-(1)+(2)');
  expect(screen.getByRole('button', { name: 'Apply 1.00' })).toBeEnabled();
});

test('discards the draft on backdrop dismissal and returns focus', async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  render(<AmountCalculator label="amount" value="12.00" currency="USD" onApply={onApply} />);
  const trigger = screen.getByRole('button', { name: 'Calculate amount' });
  await user.click(trigger);
  await user.type(screen.getByLabelText('Calculation'), '+1');
  await user.click(screen.getByRole('dialog', { name: 'Calculate amount' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(onApply).not.toHaveBeenCalled();
  expect(trigger).toHaveFocus();
});

test('applies only the calculated amount and isolates events from its parent form', async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  const onChange = vi.fn();
  const onSubmit = vi.fn<SubmitEventHandler<HTMLFormElement>>((event) => {
    event.preventDefault();
  });
  render(
    <form onChange={onChange} onSubmit={onSubmit}>
      <AmountCalculator label="amount" value="1,234.00" currency="USD" onApply={onApply} />
    </form>,
  );
  const trigger = screen.getByRole('button', { name: 'Calculate amount' });
  await user.click(trigger);
  const expression = screen.getByLabelText('Calculation');
  expect(expression).toHaveValue('1,234.00');
  await user.clear(expression);
  await user.type(expression, '(42.80+18.40)-7.20');
  expect(onApply).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Apply 54.00' })).toBeEnabled();
  await user.keyboard('{Enter}');
  expect(onApply).toHaveBeenCalledExactlyOnceWith('54.00');
  expect(onChange).not.toHaveBeenCalled();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test.each(['Cancel', 'Cancel calculation', 'Escape'])(
  'discards the draft with %s and starts afresh',
  async (dismissal) => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<AmountCalculator label="amount" value="42.80" currency="USD" onApply={onApply} />);
    const trigger = screen.getByRole('button', { name: 'Calculate amount' });
    await user.click(trigger);
    await user.type(screen.getByLabelText('Calculation'), '+10');
    if (dismissal === 'Escape') await user.keyboard('{Escape}');
    else await user.click(screen.getByRole('button', { name: dismissal }));
    expect(onApply).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    expect(screen.getByLabelText('Calculation')).toHaveValue('42.80');
  },
);

test('edits selections with the keypad and recovers from division by zero', async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  render(<AmountCalculator label="amount" value="" currency={undefined} onApply={onApply} />);
  await user.click(screen.getByRole('button', { name: 'Calculate amount' }));
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  for (const key of ['8', '÷', '0']) await user.click(screen.getByRole('button', { name: key }));
  expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(
    'Cannot divide by zero',
  );
  await user.click(screen.getByRole('button', { name: 'Delete last character' }));
  expect(within(screen.getByRole('dialog')).queryByRole('alert')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '2' }));
  const expression = screen.getByLabelText('Calculation');
  await user.click(expression);
  await user.keyboard('{Control>}a{/Control}');
  await user.click(screen.getByRole('button', { name: '6' }));
  expect(expression).toHaveValue('6');
  await user.click(screen.getByRole('button', { name: 'Apply 6.00' }));
  expect(onApply).toHaveBeenCalledExactlyOnceWith('6.00');
});

test.each([false, true])(
  'keeps the target sign restriction when negative is allowed: %s',
  async (isNegativeAllowed) => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <AmountCalculator
        label="adjustment"
        value="12.00"
        currency="USD"
        isNegativeAllowed={isNegativeAllowed}
        onApply={onApply}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Calculate adjustment' }));
    await user.click(screen.getByRole('button', { name: 'Change sign' }));
    if (isNegativeAllowed) {
      await user.click(screen.getByRole('button', { name: 'Apply -12.00' }));
      expect(onApply).toHaveBeenCalledExactlyOnceWith('-12.00');
    } else {
      expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(
        'Enter an amount over zero',
      );
      expect(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply' }),
      ).toBeDisabled();
      expect(onApply).not.toHaveBeenCalled();
    }
  },
);

test('rejects forbidden typing and paste while grouping every operand', async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  render(<AmountCalculator label="amount" value="" currency="USD" onApply={onApply} />);
  await user.click(screen.getByRole('button', { name: 'Calculate amount' }));
  const expression = screen.getByLabelText('Calculation');
  await user.type(expression, '12abc@%9');
  expect(expression).toHaveValue('129');
  await user.paste('foo');
  expect(expression).toHaveValue('129');
  await user.keyboard('{Control>}a{/Control}');
  await user.paste('1,234.56 + 2,000.44');
  expect(expression).toHaveValue('1,234.56 + 2,000.44');
  await user.keyboard('{Enter}');
  expect(onApply).toHaveBeenCalledExactlyOnceWith('3,235.00');
});
