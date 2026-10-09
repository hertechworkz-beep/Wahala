import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

try {
  if ('serviceWorker' in navigator && import.meta.env.PROD && import.meta.env.VITE_HASH_ROUTER !== '1') {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
} catch {
  /* sandboxed frames refuse service workers; the game still runs */
}
