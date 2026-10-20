import '@/styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { Providers } from '@/app/providers';
import { queryClient } from '@/app/query-client';
import { router } from '@/app/router';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('The root element is missing from index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
