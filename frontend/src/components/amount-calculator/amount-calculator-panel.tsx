import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { calculateAmount } from '@/lib/amount-calculation';
import {
  editCalculationText,
  formatCalculation,
  pasteCalculationText,
  readPlainCalculation,
} from '@/lib/amount-calculation-input';
import { formatAmountText } from '@/lib/amount-input';

import styles from './amount-calculator-panel.module.css';

const KEYS = [
  'C',
  '(',
  ')',
  '⌫',
  '7',
  '8',
  '9',
  '÷',
  '4',
  '5',
  '6',
  '×',
  '1',
  '2',
  '3',
  '−',
  '±',
  '0',
  '.',
  '+',
];
const KEY_LABELS: Readonly<Record<string, string>> = {
  C: 'Clear calculation',
  '⌫': 'Delete last character',
  '±': 'Change sign',
};

type AmountCalculatorPanelProps = Readonly<{
  initialExpression: string;
  label: string;
  currency: string | undefined;
  isNegativeAllowed: boolean;
  onApply: (amount: string) => void;
  onCancel: () => void;
}>;

function negateExpression(expression: string): string {
  let depth = 0;
  let isWholeGroup = expression.startsWith('-(') && expression.endsWith(')');
  for (let index = 1; isWholeGroup && index < expression.length - 1; index += 1) {
    if (expression[index] === '(') depth += 1;
    if (expression[index] === ')') depth -= 1;
    if (depth === 0) isWholeGroup = false;
  }
  const negated = isWholeGroup ? expression.slice(2, -1) : `-(${expression})`;
  return negated;
}

export function AmountCalculatorPanel({
  initialExpression,
  label,
  currency,
  isNegativeAllowed,
  onApply,
  onCancel,
}: AmountCalculatorPanelProps) {
  const [expression, setExpression] = useState(() => formatCalculation(initialExpression));
  const inputRef = useRef<HTMLInputElement>(null);
  const expressionId = useId();
  const errorId = useId();
  const calculation = calculateAmount({
    expression: readPlainCalculation(expression),
    isNegativeAllowed,
  });
  const amount =
    calculation.status === 'success' ? formatAmountText(calculation.amount) : undefined;

  function pressKey(key: string) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? expression.length;
    const end = input?.selectionEnd ?? start;
    let nextExpression: string;
    let caret: number;
    if (key === 'C') {
      nextExpression = '';
      caret = 0;
    } else if (key === '±') {
      nextExpression = negateExpression(expression);
      caret = nextExpression.length;
    } else {
      const prefixEnd = key === '⌫' && start === end ? Math.max(0, start - 1) : start;
      const insertion = key === '⌫' ? '' : key;
      nextExpression = `${expression.slice(0, prefixEnd)}${insertion}${expression.slice(end)}`;
      caret = prefixEnd + insertion.length;
    }

    const edited = editCalculationText({
      previousText: expression,
      text: nextExpression,
      caret,
      isForwardDelete: false,
    });
    if (edited !== undefined) {
      flushSync(() => {
        setExpression(edited.text);
      });
      input?.setSelectionRange(edited.caret, edited.caret);
    }
  }

  return (
    <div
      className={styles['panel']}
      role="presentation"
      onChange={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <div className={styles['header']} data-sheet-drag-area>
        <div>
          <h2>Calculate amount</h2>
          <p>
            {label}
            {currency === undefined ? '' : ` · ${currency}`}
          </p>
        </div>
        <button
          type="button"
          className={styles['close']}
          aria-label="Cancel calculation"
          onClick={onCancel}
        >
          ×
        </button>
      </div>
      <div className={styles['display']}>
        <label htmlFor={expressionId}>Calculation</label>
        <input
          ref={inputRef}
          id={expressionId}
          value={expression}
          type="text"
          inputMode="none"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={calculation.status === 'error'}
          aria-describedby={calculation.status === 'error' ? errorId : undefined}
          onPaste={(event) => {
            event.preventDefault();
            const input = event.currentTarget;
            const start = input.selectionStart ?? expression.length;
            const end = input.selectionEnd ?? start;
            const edited = pasteCalculationText({
              expression,
              insertedText: event.clipboardData.getData('text'),
              start,
              end,
            });
            if (edited !== undefined) {
              flushSync(() => {
                setExpression(edited.text);
              });
              input.setSelectionRange(edited.caret, edited.caret);
            }
          }}
          onChange={(event) => {
            const input = event.target;
            const caret = input.selectionStart ?? input.value.length;
            const edited = editCalculationText({
              previousText: expression,
              text: input.value,
              caret,
              isForwardDelete:
                event.nativeEvent instanceof InputEvent &&
                event.nativeEvent.inputType === 'deleteContentForward',
            });
            const nextText = edited?.text ?? expression;
            const nextCaret =
              edited?.caret ?? Math.max(0, caret - (input.value.length - expression.length));
            flushSync(() => {
              setExpression(nextText);
            });
            input.value = nextText;
            input.setSelectionRange(nextCaret, nextCaret);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (amount !== undefined) onApply(amount);
            }
          }}
        />
        <div className={styles['result']} aria-live="polite">
          <span>Result</span>
          <strong>
            {amount ?? '—'}
            {amount !== undefined && currency !== undefined && <small> {currency}</small>}
          </strong>
        </div>
        {calculation.status === 'error' && (
          <p id={errorId} className={styles['error']} role="alert">
            {calculation.message}
          </p>
        )}
      </div>
      <div className={styles['keys']}>
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-label={KEY_LABELS[key] ?? key}
            className={
              ['+', '−', '×', '÷'].includes(key)
                ? styles['operator']
                : ['C', '(', ')', '⌫', '±'].includes(key)
                  ? styles['utility']
                  : undefined
            }
            onPointerDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              pressKey(key);
            }}
          >
            {key}
          </button>
        ))}
      </div>
      <div className={styles['footer']}>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles['apply']}
          disabled={amount === undefined}
          onClick={() => {
            if (amount !== undefined) onApply(amount);
          }}
        >
          Apply{amount === undefined ? '' : ` ${amount}`}
        </button>
      </div>
      <p className={styles['keyboard']}>Enter to apply · Esc to cancel</p>
    </div>
  );
}
