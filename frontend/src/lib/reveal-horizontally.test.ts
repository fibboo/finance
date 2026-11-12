import { afterEach, describe, expect, test, vi } from 'vitest';

import { revealHorizontally } from './reveal-horizontally';

describe('revealHorizontally', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test.each([
    { case: 'at the left margin', cardLeft: 44, expectedCalls: [] },
    { case: 'one pixel into the left margin', cardLeft: 43, expectedCalls: [[{ left: 99 }]] },
    { case: 'at the right margin', cardLeft: 756, expectedCalls: [] },
    { case: 'one pixel into the right margin', cardLeft: 757, expectedCalls: [[{ left: 813 }]] },
  ])('scrolls a card $case only when it is inside a margin', ({ cardLeft, expectedCalls }) => {
    // arrange
    // the strip spans 0 to 1000, the card is 200 wide and keeps 44 clear on each side
    const strip = document.createElement('ul');
    strip.style.overflowX = 'auto';
    const card = document.createElement('li');
    card.style.scrollMarginLeft = '44px';
    card.style.scrollMarginRight = '44px';
    strip.append(card);
    document.body.append(strip);
    strip.scrollLeft = 100;
    vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 100));
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(cardLeft, 0, 200, 100));
    const scrollTo = vi.spyOn(strip, 'scrollTo');

    // act
    revealHorizontally(card);

    // assert
    expect(scrollTo.mock.calls).toEqual(expectedCalls);
  });
});
