import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { render } from '@/test/render';

import { Page } from './page';

describe('Page', () => {
  it('renders the actions in the header after the title', async () => {
    // arrange
    render(
      <Page title="Categories" actions={<button type="button">New category</button>}>
        <p>Content</p>
      </Page>,
    );

    // act
    const title = await screen.findByRole('heading', { level: 1, name: 'Categories' });

    // assert
    const actions = title.nextElementSibling;
    expect(actions).toContainElement(screen.getByRole('button', { name: 'New category' }));
    expect(actions).not.toHaveTextContent('Content');
  });

  it('renders only the title in the header of a page without actions', async () => {
    // arrange
    render(
      <Page title="Home">
        <p>Content</p>
      </Page>,
    );

    // act
    const title = await screen.findByRole('heading', { level: 1, name: 'Home' });

    // assert
    expect(title.nextElementSibling).toBeNull();
  });
});
