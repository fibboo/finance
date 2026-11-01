import type { ChangeEvent, ComponentProps } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { DATE_TEXT_PLACEHOLDER, maskDateText } from '@/lib/format-date';

export function readDateInputProps(registration: UseFormRegisterReturn): ComponentProps<'input'> {
  const dateInputProps = {
    ...registration,
    type: 'text',
    inputMode: 'numeric',
    autoComplete: 'off',
    placeholder: DATE_TEXT_PLACEHOLDER,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      event.target.value = maskDateText(event.target.value);
      void registration.onChange(event);
    },
  } satisfies ComponentProps<'input'>;
  return dateInputProps;
}
