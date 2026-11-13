import { type RefObject, useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation, useMatches } from 'react-router';
import { z } from 'zod';

import { useOutsideClick } from '@/hooks/use-outside-click';

export type MenuState = 'full' | 'collapsed' | 'collapsedByWidth' | 'openOverPage';

const menuFormSchema = z.enum(['full', 'collapsed']);

type MenuForm = z.infer<typeof menuFormSchema>;

const STORAGE_KEY = 'menu';

type UseMenuCollapseParams = Readonly<{
  menuToggleRef: RefObject<HTMLButtonElement | null>;
  readIsInside: (target: Node) => boolean;
}>;

type MenuCollapse = Readonly<{
  menuState: MenuState;
  toggleMenu: () => void;
  closeMenuOverPage: () => void;
}>;

export function readIsMenuCollapsed(menuState: MenuState): boolean {
  const isMenuCollapsed = menuState === 'collapsed' || menuState === 'collapsedByWidth';
  return isMenuCollapsed;
}

function readFullMenuMinWidth(handle: unknown): string | undefined {
  const fullMenuMinWidth =
    typeof handle === 'object' &&
    handle !== null &&
    'fullMenuMinWidth' in handle &&
    typeof handle.fullMenuMinWidth === 'string'
      ? handle.fullMenuMinWidth
      : undefined;
  return fullMenuMinWidth;
}

function readStoredMenuForm(): MenuForm {
  try {
    const storedMenuForm = menuFormSchema.safeParse(localStorage.getItem(STORAGE_KEY));
    const menuForm = storedMenuForm.success ? storedMenuForm.data : 'full';

    return menuForm;
  } catch {
    return 'full';
  }
}

function storeMenuForm(menuForm: MenuForm): void {
  try {
    localStorage.setItem(STORAGE_KEY, menuForm);
  } catch {
    return;
  }
}

function useIsNarrowerThan(query: string | undefined): boolean {
  function subscribe(onChange: () => void): () => void {
    if (query === undefined) {
      return () => undefined;
    }

    const media = window.matchMedia(query);
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }

  function readIsNarrower(): boolean {
    const isNarrower = query !== undefined && !window.matchMedia(query).matches;
    return isNarrower;
  }

  const isNarrower = useSyncExternalStore(subscribe, readIsNarrower);
  return isNarrower;
}

export function useMenuCollapse({
  menuToggleRef,
  readIsInside,
}: UseMenuCollapseParams): MenuCollapse {
  const { pathname } = useLocation();
  const fullMenuMinWidth = useMatches()
    .map((match) => readFullMenuMinWidth(match.handle))
    .findLast((minWidth) => minWidth !== undefined);
  const fullMenuQuery =
    fullMenuMinWidth === undefined ? undefined : `(min-width: ${fullMenuMinWidth})`;
  const isCollapsedByWidth = useIsNarrowerThan(fullMenuQuery);
  const [menuForm, setMenuForm] = useState(readStoredMenuForm);
  const [openOverPagePathname, setOpenOverPagePathname] = useState<string | null>(null);
  const isOpenOverPage = isCollapsedByWidth && openOverPagePathname === pathname;

  function closeMenuOverPage() {
    setOpenOverPagePathname(null);
  }

  function toggleMenu() {
    if (isCollapsedByWidth) {
      setOpenOverPagePathname(isOpenOverPage ? null : pathname);
      return;
    }

    const toggledMenuForm = menuForm === 'full' ? 'collapsed' : 'full';
    setMenuForm(toggledMenuForm);
    storeMenuForm(toggledMenuForm);
  }

  useEffect(() => {
    if (!isOpenOverPage || fullMenuQuery === undefined) {
      return;
    }

    const fullMenuMedia = window.matchMedia(fullMenuQuery);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenOverPagePathname(null);
        menuToggleRef.current?.focus();
      }
    }

    function handleWidthChange() {
      if (fullMenuMedia.matches) {
        setOpenOverPagePathname(null);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    fullMenuMedia.addEventListener('change', handleWidthChange);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      fullMenuMedia.removeEventListener('change', handleWidthChange);
    };
  }, [isOpenOverPage, fullMenuQuery, menuToggleRef]);

  useOutsideClick({
    isActive: isOpenOverPage,
    readIsInside,
    onOutsideClick: closeMenuOverPage,
  });

  let menuState: MenuState = menuForm;
  if (isCollapsedByWidth) {
    menuState = isOpenOverPage ? 'openOverPage' : 'collapsedByWidth';
  }

  return { menuState, toggleMenu, closeMenuOverPage };
}
