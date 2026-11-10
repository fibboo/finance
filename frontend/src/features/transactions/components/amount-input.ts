import type { ChangeEvent, ComponentProps, FocusEvent } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { editAmountText, formatAmountText, readPlainAmount } from '@/lib/amount-input';

const acceptedTexts = new WeakMap<HTMLInputElement, string>();

export function readAmountInputProps({
  registration,
  isNegativeAllowed,
}: Readonly<{
  registration: UseFormRegisterReturn;
  isNegativeAllowed: boolean;
}>): ComponentProps<'input'> {
  const amountInputProps = {
    ...registration,
    type: 'text',
    inputMode: 'decimal',
    autoComplete: 'off',
    placeholder: '0.00',
    onFocus: (event: FocusEvent<HTMLInputElement>) => {
      acceptedTexts.set(event.target, event.target.value);
    },
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const previousText = acceptedTexts.get(input) ?? '';
      const caret = input.selectionStart ?? input.value.length;
      const editedText = editAmountText({
        previousText,
        text: input.value,
        caret,
        isForwardDelete:
          event.nativeEvent instanceof InputEvent &&
          event.nativeEvent.inputType === 'deleteContentForward',
        isNegativeAllowed,
      });
      const nextText = editedText?.text ?? previousText;
      const nextCaret =
        editedText?.caret ?? Math.max(0, caret - (input.value.length - previousText.length));
      input.value = nextText;
      input.setSelectionRange(nextCaret, nextCaret);
      acceptedTexts.set(input, nextText);
      void registration.onChange(event);
    },
    onBlur: (event: FocusEvent<HTMLInputElement>) => {
      event.target.value = formatAmountText(readPlainAmount(event.target.value));
      void registration.onBlur(event);
    },
  } satisfies ComponentProps<'input'>;
  return amountInputProps;
}
