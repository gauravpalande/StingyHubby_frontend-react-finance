// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { supabase } from './supabaseClient';
import { SessionContextProvider } from '@supabase/auth-helpers-react';

const container = document.getElementById('root');
if (!container) throw new Error("Root container not found");

const root = (window as any).__vite_root__ ?? ReactDOM.createRoot(container);
(window as any).__vite_root__ = root;

root.render(
  <React.StrictMode>
    <SessionContextProvider supabaseClient={supabase}>
      <App />
    </SessionContextProvider>
  </React.StrictMode>
);
