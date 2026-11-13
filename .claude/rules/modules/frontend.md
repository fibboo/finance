---
paths:
  - "frontend/**"
---

# frontend

This file holds the decisions the code cannot state and their reasons. What a screen shows and does is stated by its components and their tests, and is not repeated here.

## Composition across features

Features do not import each other (`.claude/rules/react.md` **Structure**), so everything that needs two of them lives in `src/app/`. A route module or the app layout reads one feature's query and passes the result into another feature's component as props: the provider labels of the user dictionary into the user summary, the currencies and the copy of the accounting dictionary into the base-currency form, the currencies by recent use into the currency choices of a form, the base currency (`use-base-currency.ts`) into every feature that shows amounts, and the query keys a delete or a save must invalidate into the component that runs it. A picker creates its entry with a form the route passes in, for the same reason. `use-movement-choices.tsx` reads what a transaction form chooses from, each list only for the type it is given, so the New transaction sheet and the edit form share one source.

## Session

The rules are in `.claude/rules/react.md` **Auth and Security**; `features/auth/api/session.ts` and `auth-middleware.ts` implement them. Both callback URLs, `/auth/callback` and `/auth/link-callback`, must be in the backend's `ALLOWED_REDIRECT_URIS`.

## Server data

- Every query polls every 30 seconds while the tab is visible and refetches when the tab is shown again, since the same user may change the data from another device. The exceptions are the static dictionaries, which never change, the currencies by recent use, which would reorder a list while the user reads it, and the read of `accountOnDate` for the saved date in an edit form (`transaction-form.tsx`), whose refetch would restart the amount being edited.
- The transaction feed polls only while its list is at the top (`useTransactionFeed`), because a refetch of loaded pages under a scrolled list would move the rows the user is reading.
- A query that keeps failing shows the error notification once, until it loads again or a mutation succeeds, so that polling does not repeat the notification every 30 seconds.
- The sign-in and onboarding routes read their dictionary with `useQuery` without suspending and show skeletons while it loads; its error reaches the route's error boundary. The other routes decide per screen what a dictionary that failed to load hides.
- Every transaction mutation invalidates the feeds, the account and summary keys and `transactionQueries.accountOnDate`, since any of them changes balances and rates. Merging two users invalidates every query.

## State in the URL

- The chosen account, the chosen location, the chosen transaction, the search term, the transaction filters, the catalog filters and the open New transaction form are search params, each read and written by one module, which parses a typed value (an id, a value set, a date or an amount) with Zod and drops an invalid one. That module is in its feature's `api/` folder, except the search term and the Deleted toggle, which every catalog shares and so live in `components/catalog-list/`.
- A details param whose entity answers 404 is dropped.
- On desktop the details show the top row while nothing is chosen, without writing the URL, so that a shared link carries only what the user chose.
- A phone has room for one sheet, so it shows the details whose param comes later in the URL. A link that opens an account from a transaction therefore moves the `account` param after the `transaction` one.
- A desktop details column has room for the transaction and one entry beside it, so a location takes the account's place while its param comes after the `account` one. A location chosen before the transaction now shown, which is not that transaction's location, is ignored, as such an account is.
- On Categories and Income sources the `account` param holds the chosen entry, so the transaction details beside a catalog feed never read or write it: they show the first money account of the transaction (`isEntryParamOwnedByPage`), and a link to an account opens that account in its own section. Locations do the same, so that the three catalogs behave alike.
- The `transaction` param is left out of the feed's query key, so choosing a row does not refetch the list.

## One component at every width

A details view, a form and a filter panel are each one component that CSS turns from a bottom sheet on a phone into a panel, a dialog or a popover on desktop (`DetailsPanel`, `Sheet`). The app layout holds the screen height, so only a page's content scrolls. A route that pins rows above a scrolling list sets `--sticky-top` to their height, which the rows under them stick below and scroll clear of. A route shows the logo in the phone's top bar by exporting `handle = { isLogoShownOnPhone: true }`.

A route whose columns do not fit beside the full desktop menu states the width they need through `handle = { fullMenuMinWidth: '<n>rem' }`, and below it the menu collapses to icons whatever the user chose (`use-menu-collapse.ts`). Only the page knows how many columns it shows, so the layout cannot work the width out with CSS alone. Opening the full menu over the page there is not stored, so that a look at the menu on a narrow window does not change the choice a wide one keeps.

The transactions beside a catalog list are the stated exception, a secondary detail of the desktop: `hooks/use-is-desktop.ts` repeats the `--desktop` breakpoint of `styles/media.css` in script, because CSS can neither keep a hidden block from fetching its feed nor turn a link into text. The two values change together. On desktop that list scrolls inside its own block instead of the page, so that the transactions beside it keep the screen height. The details of a transaction beside that feed are a further secondary detail: `useIsWideDesktop` gives the width at which the list, the feed and the details fit beside the collapsed menu, and `CATALOG_FULL_MENU_MIN_WIDTH` the width at which they fit beside the full one. Both are sums of the tokens of those columns, the menu and the page gaps, so they change with them. Below the first the feed's rows are text and the page has no transaction details.

## Transaction feed

The feed is an infinite query whose page holds the rows the screen height fits. The Transactions section keeps the day it opened on (`isOpeningDayKept`), so that paging stays consistent across midnight, while the recent transactions of Home follow the local today. The feed drops a transaction that a shifted page repeats. A jump to a date anchors the feed there: one query pages down from the date and a second, oldest first, pages up towards today, while `use-anchor-scroll.ts` keeps the scroll position when rows are added above. The feed beside a catalog list moves its rows with the arrow keys only while the focus is in it or in the details it opened (`selection`), since the arrow keys of that page move the catalog rows otherwise.

## Transaction forms

- `MovementForm` is keyed by its type, so switching the type starts the form afresh instead of carrying fields that the new type does not have.
- The rows of one type read the form through `useFormContext`, and `movement-config.ts` holds the copy, the pickers and the currency rules of each type, so a type is described in one place.
- An edit form starts from the values read from the transaction's postings (`movement-values.ts`, `adjustment-values.ts`) and adds the transaction's own accounts and location to the choices that lack them, since a deleted one is not in the lists.
- Whether an adjustment or an income needs an amount in the base currency is decided by the backend's sums on the chosen date (`transactionQueries.accountOnDate`), not computed from the listed account; an edit asks without the edited transaction and keeps Save disabled while that read is fetched.

## Formats

One module per format, which every use goes through: `lib/format-money.ts` (two decimals whatever the currency), `lib/format-date.ts` (dd.mm.yyyy), `lib/amount-input.ts` (what may be typed as an amount, matching what the backend accepts) and `lib/account-colors.ts` (the palette; only money accounts have a color).

## Boot screen and tests

`BootScreen` repeats the markup `frontend/index.html` shows in `#root` before any script loads, so the two change together. The Vitest setup in `src/test/` starts the MSW server and stubs what jsdom lacks (`navigator.locks`, an `IntersectionObserver` that reports every observed element in view, a `matchMedia` that answers a minimum width from the window's width, the scroll methods), and signs out after each test.
