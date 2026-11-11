import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { useOutsideClick } from '@/hooks/use-outside-click';

import styles from './account-menu.module.css';

type AccountMenuProps = Readonly<{
  avatar: ReactNode;
  children: ReactNode;
}>;

export function AccountMenu({ avatar, children }: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

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
      buttonRef.current?.focus();
    },
  });

  return (
    <>
      {isOpen && (
        <div
          className={styles['backdrop']}
          data-testid="account-menu-backdrop"
          aria-hidden="true"
        />
      )}
      <div ref={menuRef} className={styles['accountMenu']}>
        <button
          ref={buttonRef}
          type="button"
          className={styles['avatar']}
          aria-label={isOpen ? 'Close account menu' : 'Account menu'}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => {
            setIsOpen(!isOpen);
          }}
        >
          {avatar}
        </button>
        {isOpen && (
          <div
            id={panelId}
            ref={(panel) => {
              panel?.focus();
            }}
            role="dialog"
            aria-label="Account"
            tabIndex={-1}
            className={styles['panel']}
          >
            {children}
          </div>
        )}
      </div>
    </>
  );
}
