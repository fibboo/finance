import { useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';

import { readPlainAmount } from '@/lib/amount-input';

import { Sheet } from '@/components/sheet/sheet';
import { AmountCalculatorPanel } from './amount-calculator-panel';
import styles from './amount-calculator.module.css';

type AmountCalculatorProps = Readonly<{
  label: string;
  value: string;
  currency: string | undefined;
  isNegativeAllowed?: boolean;
  onApply: (amount: string) => void;
}>;

export function AmountCalculator({
  label,
  value,
  currency,
  isNegativeAllowed = false,
  onApply,
}: AmountCalculatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function close() {
    flushSync(() => {
      setIsOpen(false);
    });
    triggerRef.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles['trigger']}
        aria-label={`Calculate ${label}`}
        onClick={() => {
          setIsOpen(true);
        }}
      >
        <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <rect x="5" y="2" width="14" height="20" rx="3" />
          <path d="M8 6h8M8 11h2m4 0h2M8 15h2m4 0h2M8 19h2m4 0h2" />
        </svg>
      </button>
      {isOpen &&
        createPortal(
          <Sheet className={styles['sheet']} label={`Calculate ${label}`} onClose={close}>
            <AmountCalculatorPanel
              initialExpression={readPlainAmount(value)}
              label={label}
              currency={currency}
              isNegativeAllowed={isNegativeAllowed}
              onCancel={close}
              onApply={(amount) => {
                onApply(amount);
                close();
              }}
            />
          </Sheet>,
          document.body,
        )}
    </>
  );
}
