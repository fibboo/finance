import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { useOutsideClick } from '@/hooks/use-outside-click';

import navigationStyles from './main-navigation.module.css';
import styles from './more-menu.module.css';

const MORE_ICON_PATH = 'M5 12h.01M12 12h.01M19 12h.01';

type MoreMenuProps = Readonly<{
  isCurrent: boolean;
  renderSections: (closeMenu: () => void) => ReactNode;
}>;

export function MoreMenu({ isCurrent, renderSections }: MoreMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sectionsId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useOutsideClick({
    isActive: isOpen,
    readIsInside: (target) => menuRef.current?.contains(target) === true,
    onOutsideClick: () => {
      setIsOpen(false);
    },
  });

  return (
    <div ref={menuRef} className={styles['moreMenu']}>
      <button
        ref={buttonRef}
        type="button"
        className={`${navigationStyles['section'] ?? ''} ${styles['more'] ?? ''}`}
        aria-expanded={isOpen}
        aria-controls={sectionsId}
        aria-current={isCurrent ? 'page' : undefined}
        onClick={() => {
          setIsOpen(!isOpen);
        }}
      >
        <svg className={navigationStyles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={MORE_ICON_PATH} />
        </svg>
        <span className={navigationStyles['label']}>More</span>
      </button>
      <div id={sectionsId} className={isOpen ? styles['openSections'] : styles['sections']}>
        {renderSections(() => {
          setIsOpen(false);
        })}
      </div>
    </div>
  );
}
