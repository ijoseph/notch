import React from 'react';
import { createRoot } from 'react-dom/client';
import SearchOverlay from '../../src/components/Search/SearchOverlay';
import '../../src/styles/index.css';
createRoot(document.getElementById('host')!).render(<SearchOverlay onClose={() => { document.getElementById('status')!.textContent = 'Closed'; }} />);
