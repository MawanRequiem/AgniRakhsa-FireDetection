import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster 
        theme="dark" 
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--agni-bg-tertiary)',
            border: '1px solid var(--agni-border)',
            color: 'var(--agni-text-primary)'
          },
        }}
      />
    </BrowserRouter>
  </StrictMode>,
);
