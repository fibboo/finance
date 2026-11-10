import { render as renderElement, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { Providers } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';

type Router = ReturnType<typeof createMemoryRouter>;

export function render(
  ui: ReactElement,
  { initialEntries = ['/'] }: Readonly<{ initialEntries?: string[] }> = {},
): RenderResult & Readonly<{ router: Router }> {
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
