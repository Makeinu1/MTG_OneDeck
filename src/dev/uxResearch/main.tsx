import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import { CoverageDashboard } from './CoverageDashboard';

const root = document.getElementById('root');
if (!root) throw new Error('UX research dashboard root is missing');

createRoot(root).render(
  <StrictMode>
    <CoverageDashboard />
  </StrictMode>,
);

