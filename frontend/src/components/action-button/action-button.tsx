import { useEffect, useId, useState } from 'react';
import { Link, type To } from 'react-router';

import styles from './action-button.module.css';

const TIP_DURATION_MS = 4000;

type Action =
  | Readonly<{ kind: 'link'; to: To; isScrollKept: boolean }>
  | Readonly<{ kind: 'button'; blockingHint: string | undefined; onClick: () => void }>;

type ActionButtonProps = Readonly<{
  id?: string;
  label: string;
  iconPath: string;
  isDanger: boolean;
  action: Action;
}>;

export function ActionButton({ id, label, iconPath, isDanger, action }: ActionButtonProps) {
  const hintId = useId();
  const isBlocked = action.kind === 'button' && action.blockingHint !== undefined;
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isTapped, setIsTapped] = useState(false);
  useEffect(() => {
    if (!isTapped) {
      return;
    }

    function hideTip() {
      setIsTapped(false);
    }

    const timeoutId = window.setTimeout(hideTip, TIP_DURATION_MS);
    document.addEventListener('pointerdown', hideTip, { capture: true });
    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener('pointerdown', hideTip, { capture: true });
    };
  }, [isTapped]);

  const isTipShown = isBlocked && (isHovered || isFocused || isTapped);
  useEffect(() => {
    if (!isTipShown) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsHovered(false);
        setIsFocused(false);
        setIsTapped(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isTipShown]);

  const className = `${styles['actionButton'] ?? ''} ${isDanger ? (styles['danger'] ?? '') : ''}`;
  const icon = (
    <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
      <path d={iconPath} />
    </svg>
  );
  if (action.kind === 'link') {
    return (
      <Link
        id={id}
        to={action.to}
        preventScrollReset={action.isScrollKept}
        aria-label={label}
        title={label}
        className={className}
      >
        {icon}
      </Link>
    );
  }

  const { blockingHint, onClick } = action;
  return (
    <>
      {isBlocked && (
        <span id={hintId} className={styles['hint']}>
          <svg className={styles['hintIcon']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={iconPath} />
          </svg>
          <span className={styles['hintText']}>{blockingHint}</span>
        </span>
      )}
      <button
        id={id}
        type="button"
        aria-label={label}
        title={isBlocked ? undefined : label}
        aria-disabled={isBlocked}
        aria-describedby={isBlocked ? hintId : undefined}
        className={className}
        data-tip-shown={isTipShown}
        onClick={() => {
          if (isBlocked) {
            setIsTapped(true);
          } else {
            onClick();
          }
        }}
        onPointerEnter={(event) => {
          setIsHovered(event.pointerType === 'mouse');
        }}
        onPointerLeave={(event) => {
          setIsHovered(false);
          if (event.pointerType !== 'touch') {
            setIsTapped(false);
          }
        }}
        onFocus={(event) => {
          setIsFocused(event.currentTarget.matches(':focus-visible'));
        }}
        onBlur={() => {
          setIsFocused(false);
          setIsTapped(false);
        }}
      >
        {icon}
        {isTipShown && (
          <span role="tooltip" className={styles['tip']}>
            {blockingHint}
          </span>
        )}
      </button>
    </>
  );
}
