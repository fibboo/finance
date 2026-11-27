import { matchPath } from 'react-router';

import { TRANSACTIONS_ICON_PATH } from '@/components/action-button/action-icons';

import { CATEGORY_ICON_PATH } from './category-icon';
import { INCOME_SOURCE_ICON_PATH } from './income-source-icon';
import { LOCATION_ICON_PATH } from '@/components/location-icon';

const HOME_ICON_PATH = 'M4 11 12 4l8 7v9h-5v-6H9v6H4z';
const ACCOUNTS_ICON_PATH =
  'M6 6h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3M3 10h18M16 14.5h2';

type Section = Readonly<{ name: string; path: string; iconPath: string }>;

export const SECTIONS = [
  { name: 'Home', path: '/', iconPath: HOME_ICON_PATH },
  { name: 'Transactions', path: '/transactions', iconPath: TRANSACTIONS_ICON_PATH },
  { name: 'Accounts', path: '/accounts', iconPath: ACCOUNTS_ICON_PATH },
  { name: 'Categories', path: '/categories', iconPath: CATEGORY_ICON_PATH },
] as const satisfies readonly Section[];

export const MORE_SECTIONS = [
  {
    name: 'Locations',
    path: '/locations',
    iconPath: LOCATION_ICON_PATH,
  },
  {
    name: 'Income sources',
    path: '/income-sources',
    iconPath: INCOME_SOURCE_ICON_PATH,
  },
] as const satisfies readonly Section[];

export function isSectionShown({
  section,
  pathname,
}: Readonly<{ section: Section; pathname: string }>): boolean {
  const isShown = matchPath({ path: section.path, end: section.path === '/' }, pathname) !== null;
  return isShown;
}

export function findShownSection(pathname: string): Section | undefined {
  const shownSection = [...SECTIONS, ...MORE_SECTIONS].find((section) =>
    isSectionShown({ section, pathname }),
  );
  return shownSection;
}
