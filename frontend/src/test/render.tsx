import { render as renderElement, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, type DataRouter, RouterProvider } from 'react-router';

import { Providers } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';

export function render(
  ui: ReactElement,
  { initialEntries = ['/'] }: Readonly<{ initialEntries?: string[] }> = {},
): RenderResult & Readonly<{ router: DataRouter }> {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  });
  const router = createMemoryRouter([{ path: '*', element: ui }], { initialEntries });
  const renderResult = renderElement(
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );
  const result = { ...renderResult, router };
  return result;
}
