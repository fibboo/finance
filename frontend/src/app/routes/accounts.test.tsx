import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, onTestFinished, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { Component } from './accounts';

const wallet = {
  name: 'Wallet',
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a03',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  kind: 'ASSET',
  balance: '412.50',
  currency: 'USD',
  color: '#4D8FBF',
  category_type: null,
  base_currency_rate: '1',
  status: 'ACTIVE',
  base_currency_balance: '412.50',
} satisfies components['schemas']['Account'];

const creditCard = {
  ...wallet,
  name: 'Credit card',
  id: '8c1a7f0c-2f4e-4b9e-9d1f-0e6a3c2b1a04',
  kind: 'LIABILITY',
  balance: '-318.40',
  color: '#C2613F',
  base_currency_balance: '-318.40',
} satisfies components['schemas']['Account'];

const travelCard = {
  ...wallet,
  name: 'Travel card',
  id: '2f4e8c1a-7f0c-4b9e-9d1f-0e6a3c2b1a05',
  balance: '0',
  color: '#5B6CD9',
  base_currency_balance: '0',
} satisfies components['schemas']['Account'];

beforeEach(() => {
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: 'USD',
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
    http.get('http://localhost/api/dictionaries/accounting', () =>
      HttpResponse.json({
        currencies: [{ key: 'USD', label: 'US Dollar' }],
        account_kinds: [
          { key: 'ASSET', label: 'Asset' },
          { key: 'LIABILITY', label: 'Liability' },
        ],
        category_types: [],
        transaction_types: [],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
    http.get('http://localhost/api/accounting/currencies', () =>
      HttpResponse.json([
        { key: 'USD', label: 'US Dollar' },
      ] satisfies components['schemas']['DictionaryItem'][]),
    ),
    // the details of the top account, which show while no account is chosen
    http.get('http://localhost/api/accounting/accounts/:accountId', ({ params }) => {
      const account = [wallet, creditCard, travelCard].find(
        (item) => item.id === params['accountId'],
      );
      return account === undefined
        ? HttpResponse.json(
            { error_code: 'NOT_FOUND', message: 'Account not found' },
            { status: 404 },
          )
        : HttpResponse.json(account);
    }),
  );
});

test('shows the number of money accounts next to the title and lists them by kind', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) =>
      new URL(request.url).searchParams.getAll('kinds').join() === 'ASSET,LIABILITY' &&
      new URL(request.url).searchParams.get('order') === 'recent_use'
        ? HttpResponse.json({
            items: [wallet, creditCard],
            total: 2,
            page: 1,
            size: 100,
            pages: 1,
          } satisfies components['schemas']['Page_Account_'])
        : HttpResponse.json(null, { status: 400 }),
    ),
  );

  // act
  render(<Component />);

  // assert
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Accounts, 2 accounts' }),
  ).toBeInTheDocument();
  expect(await screen.findByRole('region', { name: 'Assets' })).toHaveTextContent('Wallet');
  expect(screen.getByRole('region', { name: 'Liabilities' })).toHaveTextContent('Credit card');
});

test('creates an account from New account and lists it', async () => {
  // arrange
  const user = userEvent.setup();
  let accounts: components['schemas']['Account'][] = [wallet];
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: accounts,
        total: accounts.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.post('http://localhost/api/accounting/accounts', () => {
      accounts = [wallet, travelCard];
      return HttpResponse.json(travelCard);
    }),
  );
  render(<Component />);
  await screen.findByRole('region', { name: 'Assets' });
  await user.click(await screen.findByRole('button', { name: 'New account' }));
  const form = await screen.findByRole('form', { name: 'New account' });
  await user.type(within(form).getByRole('textbox', { name: 'Name' }), 'Travel card');

  // act
  await user.click(within(form).getByRole('button', { name: 'Create account' }));

  // assert
  expect(await screen.findByText('Travel card')).toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'New account' })).not.toBeInTheDocument();
});

test('lists the currencies of New account in the order of their recent use', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [wallet],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get('http://localhost/api/accounting/currencies', () =>
      HttpResponse.json([
        { key: 'EUR', label: 'Euro' },
        { key: 'USD', label: 'US Dollar' },
      ] satisfies components['schemas']['DictionaryItem'][]),
    ),
  );
  const user = userEvent.setup();
  render(<Component />);
  const newAccountButton = await screen.findByRole('button', { name: 'New account' });
  await waitFor(() => {
    expect(newAccountButton).toBeEnabled();
  });

  // act
  await user.click(newAccountButton);

  // assert
  const form = await screen.findByRole('form', { name: 'New account' });
  expect(
    within(within(form).getByRole('combobox', { name: 'Currency' }))
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['EUR · Euro', 'USD · US Dollar']);
});

test('keeps the accounts listed and New account disabled when the dictionary fails', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/dictionaries/accounting', () =>
      HttpResponse.json(null, { status: 500 }),
    ),
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [wallet],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
  );

  // act
  render(<Component />);

  // assert
  expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Assets' })).toHaveTextContent('Wallet');
  expect(screen.getByRole('button', { name: 'New account' })).toBeDisabled();
});

test('narrows the groups to the accounts matching a term of at least 3 characters', async () => {
  // arrange
  const user = userEvent.setup();
  const searchTerms: (string | null)[] = [];
  const orders: (string | null)[] = [];
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const searchTerm = new URL(request.url).searchParams.get('search_term');
      searchTerms.push(searchTerm);
      orders.push(new URL(request.url).searchParams.get('order'));
      const items = searchTerm === 'cre' ? [creditCard] : [wallet, creditCard];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
  );
  render(<Component />);
  await screen.findByRole('region', { name: 'Assets' });
  await user.type(screen.getByRole('searchbox', { name: 'Search accounts' }), 'cr');

  // act
  await user.type(screen.getByRole('searchbox', { name: 'Search accounts' }), 'e');

  // assert
  await waitFor(() => {
    expect(screen.queryByRole('region', { name: 'Assets' })).not.toBeInTheDocument();
  });
  expect(screen.getByRole('region', { name: 'Liabilities' })).toHaveTextContent('Credit card');
  expect(
    screen.getByRole('heading', { level: 1, name: 'Accounts, 2 accounts' }),
  ).toBeInTheDocument();
  expect(searchTerms).toEqual([null, 'cre']);
  expect(orders).toEqual(['recent_use', 'recent_use']);
});

test('reads the term from the URL and clears it into a focused field when nothing matches', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const items =
        new URL(request.url).searchParams.get('search_term') === 'cash' ? [] : [wallet, creditCard];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
  );
  render(<Component />, { initialEntries: ['/?search=cash'] });
  expect(screen.getByRole('searchbox', { name: 'Search accounts' })).toHaveValue('cash');

  // act
  await user.click(await screen.findByRole('button', { name: 'Clear search' }));

  // assert
  expect(await screen.findByRole('region', { name: 'Assets' })).toHaveTextContent('Wallet');
  expect(screen.getByRole('searchbox', { name: 'Search accounts' })).toHaveValue('');
  expect(screen.getByRole('searchbox', { name: 'Search accounts' })).toHaveFocus();
  expect(screen.queryByText('No accounts match this search')).not.toBeInTheDocument();
});

const mainCard = {
  ...wallet,
  name: 'Main card',
  id: '5b6cd902-8c1a-4b9e-9d1f-0e6a3c2b1a06',
  balance: '3180.00',
  currency: 'EUR',
  color: '#5B6CD9',
  description: 'Salary card, Intesa',
  base_currency_rate: '0.9161',
  base_currency_balance: '3471.20',
} satisfies components['schemas']['Account'];

test('opens an account from its row with its balance, description and actions', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [wallet, mainCard],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get(`http://localhost/api/accounting/accounts/${mainCard.id}`, () =>
      HttpResponse.json(mainCard),
    ),
  );
  render(<Component />);

  // act
  await user.click(await screen.findByRole('link', { name: 'Main card' }));

  // assert
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  expect(await within(details).findByRole('heading', { name: 'Main card' })).toBeInTheDocument();
  expect(details).toHaveTextContent('Asset · EUR');
  expect(details).toHaveTextContent('€3,180.00');
  expect(details).toHaveTextContent('$3,471.20 · rate 0.9161');
  expect(details).toHaveTextContent('Salary card, Intesa');
  expect(within(details).getByRole('link', { name: 'Adjust balance' })).toHaveAttribute(
    'href',
    `/?account=${mainCard.id}&new_transaction=ADJUSTMENT&new_transaction_account=${mainCard.id}`,
  );
  expect(within(details).getByRole('link', { name: 'Transactions' })).toHaveAttribute(
    'href',
    `/transactions?account_ids=${mainCard.id}`,
  );
  expect(screen.getByRole('link', { name: 'Main card' })).toHaveAttribute('aria-current', 'true');
});

test.each([
  { currency: 'EUR', rate: '0.9161', baseBalance: '$3,471.20 · rate 0.9161' },
  { currency: 'EUR', rate: '0', baseBalance: '$3,471.20' },
  { currency: 'USD', rate: '1', baseBalance: '$3,471.20' },
])(
  'shows the rate of a $currency account at rate $rate only outside the base currency',
  async ({ currency, rate, baseBalance }) => {
    // arrange
    const account = { ...mainCard, currency, base_currency_rate: rate };
    server.use(
      http.get('http://localhost/api/accounting/accounts', () =>
        HttpResponse.json({
          items: [account],
          total: 1,
          page: 1,
          size: 100,
          pages: 1,
        } satisfies components['schemas']['Page_Account_']),
      ),
      http.get(`http://localhost/api/accounting/accounts/${mainCard.id}`, () =>
        HttpResponse.json(account),
      ),
    );

    // act
    render(<Component />, { initialEntries: [`/?account=${mainCard.id}`] });

    // assert
    const details = await screen.findByRole('dialog', { name: 'Account details' });
    await within(details).findByRole('heading', { name: 'Main card' });
    expect(within(details).getByText(baseBalance, { exact: true })).toBeInTheDocument();
  },
);

test('closes the account with Escape, returns focus to its row and shows the top account', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [wallet, mainCard],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get(`http://localhost/api/accounting/accounts/${mainCard.id}`, () =>
      HttpResponse.json(mainCard),
    ),
  );
  render(<Component />);
  await user.click(await screen.findByRole('link', { name: 'Main card' }));
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  expect(
    await within(details).findByRole('heading', { level: 2, name: 'Main card' }),
  ).toBeInTheDocument();

  // act
  await user.keyboard('{Escape}');

  // assert
  const topDetails = await screen.findByRole('dialog', { name: 'Account details' });
  expect(
    await within(topDetails).findByRole('heading', { level: 2, name: 'Wallet' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Main card' })).toHaveFocus();
});

test('keeps the focus on the rows while the arrow keys move through them and shows each account', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [wallet, travelCard, creditCard],
        total: 3,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
  );
  render(<Component />);
  await screen.findByRole('link', { name: 'Wallet' });
  await user.tab();
  await user.tab();
  await user.tab();
  expect(screen.getByRole('link', { name: 'Wallet' })).toHaveFocus();

  // act
  await user.keyboard('{ArrowDown}{ArrowDown}');

  // assert
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  expect(
    await within(details).findByRole('heading', { level: 2, name: 'Credit card' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Credit card' })).toHaveFocus();
});

test('moves to the next account with an arrow key after a row was clicked', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [wallet, travelCard, creditCard],
        total: 3,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
  );
  render(<Component />);
  await user.click(await screen.findByRole('link', { name: 'Travel card' }));
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  await within(details).findByRole('heading', { level: 2, name: 'Travel card' });

  // act
  await user.keyboard('{ArrowDown}');

  // assert
  expect(
    await within(details).findByRole('heading', { level: 2, name: 'Credit card' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Credit card' })).toHaveFocus();
});

test('keeps the focus in the search field typed in after an arrow-key selection', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [wallet, travelCard],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
  );
  render(<Component />);
  await screen.findByRole('link', { name: 'Wallet' });
  await user.tab();
  await user.tab();
  await user.tab();
  await user.keyboard('{ArrowDown}');
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  await within(details).findByRole('heading', { level: 2, name: 'Travel card' });

  // act
  await user.type(screen.getByRole('searchbox', { name: 'Search accounts' }), 'tra');

  // assert
  const searchField = screen.getByRole('searchbox', { name: 'Search accounts' });
  expect(searchField).toHaveFocus();
  expect(searchField).toHaveValue('tra');
});

test('shows the details of the top account while no account is chosen', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [creditCard, mainCard],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get(`http://localhost/api/accounting/accounts/${mainCard.id}`, () =>
      HttpResponse.json(mainCard),
    ),
  );

  // act
  render(<Component />);

  // assert
  // the assets group comes first, so its first account is the top one
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  expect(
    await within(details).findByRole('heading', { level: 2, name: 'Main card' }),
  ).toBeInTheDocument();
  expect(details).not.toHaveFocus();
  expect(screen.getByRole('link', { name: 'Main card' })).not.toHaveAttribute('aria-current');
});

test('drops the account param of an account that does not exist', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [mainCard],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get(`http://localhost/api/accounting/accounts/${mainCard.id}`, () =>
      HttpResponse.json({ error_code: 'NOT_FOUND', message: 'Account not found' }, { status: 404 }),
    ),
  );

  // act
  render(<Component />, { initialEntries: [`/?account=${mainCard.id}`] });

  // assert
  const accountLink = await screen.findByRole('link', { name: 'Main card' });
  await waitFor(() => {
    expect(accountLink).not.toHaveAttribute('aria-current');
  });
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Account details' })).not.toBeInTheDocument();
  });
  expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
});

test('edits an account from its details and lists it under the new name', async () => {
  // arrange
  const user = userEvent.setup();
  let account: components['schemas']['Account'] = mainCard;
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [account],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get(`http://localhost/api/accounting/accounts/${mainCard.id}`, () =>
      HttpResponse.json(account),
    ),
    http.put(`http://localhost/api/accounting/accounts/${mainCard.id}`, () => {
      account = { ...mainCard, name: 'Salary card' };
      return HttpResponse.json(account);
    }),
  );
  render(<Component />, { initialEntries: [`/?account=${mainCard.id}`] });
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  await user.click(await within(details).findByRole('button', { name: 'Edit' }));
  const form = await screen.findByRole('form', { name: 'Edit account' });
  await within(form).findByText('Dimmed colors are used by other accounts.');
  const nameField = within(form).getByRole('textbox', { name: 'Name' });
  await user.clear(nameField);
  await user.type(nameField, 'Salary card');

  // act
  await user.click(within(form).getByRole('button', { name: 'Save changes' }));

  // assert
  expect(await screen.findByRole('link', { name: 'Salary card' })).toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'Edit account' })).not.toBeInTheDocument();
  expect(
    within(screen.getByRole('dialog', { name: 'Account details' })).getByRole('heading', {
      name: 'Salary card',
    }),
  ).toBeInTheDocument();
});

test('closes the edit form when Back shows another account and keeps it closed on Forward', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [wallet, travelCard],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
  );
  const { router } = render(<Component />);
  await user.click(await screen.findByRole('link', { name: 'Travel card' }));
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  await within(details).findByRole('heading', { level: 2, name: 'Travel card' });
  await user.click(screen.getByRole('link', { name: 'Wallet' }));
  await within(details).findByRole('heading', { level: 2, name: 'Wallet' });
  await user.click(within(details).getByRole('button', { name: 'Edit' }));
  const form = await screen.findByRole('form', { name: 'Edit account' });
  const nameField = within(form).getByRole('textbox', { name: 'Name' });
  await user.clear(nameField);
  await user.type(nameField, 'Cash');
  // the browser's Back shows the other account, which closes the form
  await router.navigate(-1);
  expect(
    await within(screen.getByRole('dialog', { name: 'Account details' })).findByRole('heading', {
      level: 2,
      name: 'Travel card',
    }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'Edit account' })).not.toBeInTheDocument();

  // act: the user presses the browser's Forward
  await router.navigate(1);

  // assert
  expect(
    await within(screen.getByRole('dialog', { name: 'Account details' })).findByRole('heading', {
      level: 2,
      name: 'Wallet',
    }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'Edit account' })).not.toBeInTheDocument();
});

test('drops the account param of an account that is not a money account', async () => {
  // arrange
  const groceries = {
    ...wallet,
    name: 'Groceries',
    id: '3c2b1a04-8c1a-4b9e-9d1f-0e6a7f0c2f4e',
    kind: 'EXPENSE',
    currency: null,
    color: null,
    category_type: 'VARIABLE',
  } satisfies components['schemas']['Account'];
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [wallet],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get(`http://localhost/api/accounting/accounts/${groceries.id}`, () =>
      HttpResponse.json(groceries),
    ),
  );

  // act
  render(<Component />, { initialEntries: [`/?account=${groceries.id}`] });

  // assert
  await screen.findByRole('link', { name: 'Wallet' });
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Account details' })).not.toBeInTheDocument();
  });
  expect(screen.queryByRole('heading', { name: 'Groceries' })).not.toBeInTheDocument();
});

test.each([
  { case: 'the next account', search: '', focusedName: 'Credit card' },
  { case: 'the search when no account is left listed', search: 'trav', focusedName: undefined },
])(
  'deletes an account after the confirmation and moves focus to $case',
  async ({ search, focusedName }) => {
    // arrange
    const user = userEvent.setup();
    let isDeleted = false;
    let deletePath = '';
    server.use(
      http.get('http://localhost/api/accounting/accounts', ({ request }) => {
        const isSearched = new URL(request.url).searchParams.has('search_term');
        const remainingAccounts = isDeleted
          ? [wallet, creditCard]
          : [wallet, travelCard, creditCard];
        const items = isSearched
          ? remainingAccounts.filter((account) => account.id === travelCard.id)
          : remainingAccounts;
        return HttpResponse.json({
          items,
          total: items.length,
          page: 1,
          size: 100,
          pages: 1,
        } satisfies components['schemas']['Page_Account_']);
      }),
      http.get(`http://localhost/api/accounting/accounts/${travelCard.id}`, () =>
        HttpResponse.json(travelCard),
      ),
      http.delete('http://localhost/api/accounting/accounts/:accountId', ({ request }) => {
        deletePath = new URL(request.url).pathname;
        isDeleted = true;
        return HttpResponse.json({ ...travelCard, status: 'DELETED' });
      }),
    );
    render(<Component />, {
      initialEntries: [`/?search=${search}&account=${travelCard.id}`],
    });
    const details = await screen.findByRole('dialog', { name: 'Account details' });
    await user.click(await within(details).findByRole('button', { name: 'Delete account' }));
    const confirmation = screen.getByRole('alertdialog', { name: 'Delete this account?' });
    expect(confirmation).toHaveAccessibleDescription(
      'Travel card, $0.00. It leaves your accounts and the pickers, and its past transactions keep showing it.',
    );

    // act
    await user.click(within(confirmation).getByRole('button', { name: 'Delete' }));

    // assert
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Travel card' })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: 'Travel card' })).not.toBeInTheDocument();
    expect(
      focusedName === undefined
        ? screen.getByRole('searchbox', { name: 'Search accounts' })
        : screen.getByRole('link', { name: focusedName }),
    ).toHaveFocus();
    expect(deletePath).toBe(`/api/accounting/accounts/${travelCard.id}`);
  },
);

test('shows the top account without a confirmation after the chosen account is deleted', async () => {
  // arrange
  const user = userEvent.setup();
  let isDeleted = false;
  server.use(
    http.get('http://localhost/api/accounting/accounts', () => {
      const items = isDeleted ? [wallet, creditCard] : [wallet, travelCard, creditCard];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
    http.delete(`http://localhost/api/accounting/accounts/${travelCard.id}`, () => {
      isDeleted = true;
      return HttpResponse.json({ ...travelCard, status: 'DELETED' });
    }),
  );
  render(<Component />);
  // the top account shows first, so its details are loaded before the deletion returns to them
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  await within(details).findByRole('heading', { level: 2, name: 'Wallet' });
  await user.click(screen.getByRole('link', { name: 'Travel card' }));
  await within(details).findByRole('heading', { level: 2, name: 'Travel card' });
  await user.click(within(details).getByRole('button', { name: 'Delete account' }));
  const confirmation = screen.getByRole('alertdialog', { name: 'Delete this account?' });

  // act
  await user.click(within(confirmation).getByRole('button', { name: 'Delete' }));

  // assert
  const topDetails = await screen.findByRole('dialog', { name: 'Account details' });
  expect(
    await within(topDetails).findByRole('heading', { level: 2, name: 'Wallet' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Travel card' })).not.toBeInTheDocument();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test.each([
  {
    case: 'its balance is not zero',
    account: wallet,
    items: [wallet, travelCard],
    hint: 'Bring the balance to zero to delete.',
  },
  {
    case: 'it is the only money account',
    account: travelCard,
    items: [travelCard],
    hint: "Your only money account can't be deleted.",
  },
])('disables Delete account with a hint while $case', async ({ account, items, hint }) => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get(`http://localhost/api/accounting/accounts/${account.id}`, () =>
      HttpResponse.json(account),
    ),
  );

  // act
  render(<Component />, { initialEntries: [`/?account=${account.id}`] });

  // assert
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  await screen.findByRole('link', { name: account.name });
  const deleteButton = await within(details).findByRole('button', { name: 'Delete account' });
  expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
  expect(deleteButton).toHaveAccessibleDescription(hint);
});

test('refetches the account when the deletion is refused', async () => {
  // arrange
  const user = userEvent.setup();
  let account: components['schemas']['Account'] = travelCard;
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [wallet, account],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get(`http://localhost/api/accounting/accounts/${travelCard.id}`, () =>
      HttpResponse.json(account),
    ),
    http.delete('http://localhost/api/accounting/accounts/:accountId', () => {
      account = { ...travelCard, balance: '25', base_currency_balance: '25' };
      return HttpResponse.json(
        {
          error_code: 'ACCOUNT_DELETION_FORBIDDEN',
          message: 'Only an account with a zero balance can be deleted',
        },
        { status: 403 },
      );
    }),
  );
  render(<Component />, { initialEntries: [`/?account=${travelCard.id}`] });
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  await user.click(await within(details).findByRole('button', { name: 'Delete account' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Delete' }));

  // assert
  const deleteButton = await within(details).findByRole('button', {
    name: 'Delete account',
    description: 'Bring the balance to zero to delete.',
  });
  expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
  expect(deleteButton).toHaveFocus();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test('keeps the accounts on screen and notifies once when their refetch fails', async () => {
  // arrange
  const user = userEvent.setup();
  onTestFinished(() => {
    Reflect.deleteProperty(document, 'visibilityState');
  });
  let accountsResponse = 'ok';
  server.use(
    http.get('http://localhost/api/accounting/accounts', () => {
      if (accountsResponse === 'failing') {
        return HttpResponse.json({ message: 'Server error' }, { status: 500 });
      }
      const account = accountsResponse === 'ok' ? mainCard : { ...mainCard, name: 'Daily card' };
      return HttpResponse.json({
        items: [account],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
  );
  render(<Component />);
  expect(await screen.findByRole('link', { name: 'Main card' })).toBeInTheDocument();
  accountsResponse = 'failing';

  // act: the user leaves the tab and comes back
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));

  // assert
  expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Main card' })).toBeInTheDocument();
  // a renamed account after the next return shows that the page stayed and kept refetching
  await user.click(screen.getByRole('button', { name: 'Dismiss' }));
  accountsResponse = 'renamed';
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  expect(await screen.findByRole('link', { name: 'Daily card' })).toBeInTheDocument();
});
