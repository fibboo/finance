import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';

import { showErrorNotification } from '@/components/error-notification/error-notification-store';
import { render } from '@/test/render';

test('hides the notification when dismissed', async () => {
  // arrange
  const user = userEvent.setup();
  showErrorNotification();
  render(<main />);

  // act
  await user.click(screen.getByRole('button', { name: 'Dismiss' }));

  // assert
  expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
});
