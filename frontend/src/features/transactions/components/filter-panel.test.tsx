import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';

import { render } from '@/test/render';

import { FilterPanel } from './filter-panel';

test('stays open while the press outside the panel is held', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <>
      <FilterPanel title="Period" chipLabel="Period" isActive={false}>
        {() => <p>Period choices</p>}
      </FilterPanel>
      <p>Transactions</p>
    </>,
  );
  await user.click(screen.getByRole('button', { name: 'Period' }));

  // act
  await user.pointer({ keys: '[TouchA>]', target: screen.getByText('Transactions') });

  // assert
  expect(screen.getByRole('dialog', { name: 'Period' })).toBeInTheDocument();
});

test('closes on a tap on another chip without opening its panel', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <>
      <FilterPanel title="Period" chipLabel="Period" isActive={false}>
        {() => <p>Period choices</p>}
      </FilterPanel>
      <FilterPanel title="Type" chipLabel="Type" isActive={false}>
        {() => <p>Type choices</p>}
      </FilterPanel>
    </>,
  );
  await user.click(screen.getByRole('button', { name: 'Period' }));

  // act
  await user.pointer({ keys: '[TouchA]', target: screen.getByRole('button', { name: 'Type' }) });

  // assert
  expect(screen.queryByRole('dialog', { name: 'Period' })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Type' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Period' })).toHaveFocus();
  // the next tap opens the other panel
  await user.pointer({ keys: '[TouchA]', target: screen.getByRole('button', { name: 'Type' }) });
  expect(screen.getByRole('dialog', { name: 'Type' })).toBeInTheDocument();
});
