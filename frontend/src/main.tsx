import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { PlaceholderPage } from '@/app/placeholder-page';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('The root element is missing from index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <PlaceholderPage />
  </StrictMode>,
);
