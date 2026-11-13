import type { ArrowKeySelectionProps } from '@/hooks/use-arrow-key-selection';

export const TRANSACTION_ARROW_KEY_LIST = {
  'data-arrow-key-list': 'transactions',
  'data-arrow-key-orientation': 'vertical',
} as const satisfies ArrowKeySelectionProps;
