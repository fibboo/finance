import { useEffect, useState, useSyncExternalStore } from 'react';
import { useMatches } from 'react-router';
import { z } from 'zod';

import { useOutsideClick } from '@/hooks/use-outside-click';

export type MenuState = 'full' | 'collapsed' | 'openOverPage';

const menuFormSchema = z.enum(['full', 'collapsed']);

type MenuForm = z.infer<typeof menuFormSchema>;

const STORAGE_KEY = 'menu';

type UseMenuCollapseParams = Readonly<{
  readIsInside: (target: Node) => boolean;
}>;

type MenuCollapse = Readonly<{
  menuState: MenuState;
  toggleMenu: () => void;
  closeMenuOverPage: () => void;
}>;

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

function useIsNarrowerThan(minWidth: string | undefined): boolean {
  const query = minWidth === undefined ? undefined : `(min-width: ${minWidth})`;

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

export function useMenuCollapse({ readIsInside }: UseMenuCollapseParams): MenuCollapse {
  const fullMenuMinWidth = useMatches()
    .map((match) => readFullMenuMinWidth(match.handle))
    .findLast((minWidth) => minWidth !== undefined);
  const isCollapsedByWidth = useIsNarrowerThan(fullMenuMinWidth);
  const [menuForm, setMenuForm] = useState(readStoredMenuForm);
  const [isOpenOverPage, setIsOpenOverPage] = useState(false);
  const isMenuOpenOverPage = isCollapsedByWidth && isOpenOverPage;

  function closeMenuOverPage() {
    setIsOpenOverPage(false);
  }

  function toggleMenu() {
    if (isCollapsedByWidth) {
      setIsOpenOverPage(!isOpenOverPage);
      return;
    }

    const toggledMenuForm = menuForm === 'full' ? 'collapsed' : 'full';
    setMenuForm(toggledMenuForm);
    storeMenuForm(toggledMenuForm);
  }

  useEffect(() => {
    if (!isMenuOpenOverPage) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpenOverPage(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpenOverPage]);

  useOutsideClick({
    isActive: isMenuOpenOverPage,
    readIsInside,
    onOutsideClick: closeMenuOverPage,
  });

  let menuState: MenuState = menuForm;
  if (isCollapsedByWidth) {
    menuState = isOpenOverPage ? 'openOverPage' : 'collapsed';
  }

  return { menuState, toggleMenu, closeMenuOverPage };
}
