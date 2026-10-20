import { screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { PlaceholderPage } from '@/app/placeholder-page';
import { render } from '@/test/render';

test('shows the app name', () => {
  // act
  render(<PlaceholderPage />);

  // assert
  expect(screen.getByRole('heading', { name: 'Finance' })).toBeInTheDocument();
});
