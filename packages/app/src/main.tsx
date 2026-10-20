import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.tsx';
import { StoreProvider } from './lib/useStore.tsx';
import { applyTheme, readTheme, watchSystemTheme } from './lib/theme.ts';
import './index.css';

applyTheme(readTheme());
watchSystemTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </HashRouter>
  </React.StrictMode>,
);
