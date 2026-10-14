import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '../style.css';
import '../theme.css';
import './enhancements.css';

createRoot(document.getElementById('root')).render(<App />);

// Installable app (PWA). Only in production builds, so the dev server is never served from cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
