import { render as renderElement, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, type DataRouter, RouterProvider } from 'react-router';

import { Providers } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';

export function render(
  ui: ReactElement,
  {
    initialEntries = ['/'],
    handle,
  }: Readonly<{ initialEntries?: string[]; handle?: Readonly<Record<string, unknown>> }> = {},
): RenderResult & Readonly<{ router: DataRouter }> {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  });
  const router = createMemoryRouter([{ path: '*', element: ui, handle }], { initialEntries });
  const renderResult = renderElement(
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );
  const result = { ...renderResult, router };
  return result;
}
