import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <BrowserRouter>
        <App />
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--ifrit-bg-tertiary)',
              border: '1px solid var(--ifrit-border)',
              color: 'var(--ifrit-text-primary)'
            },
          }}
        />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
