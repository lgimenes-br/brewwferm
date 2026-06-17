import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrewProvider } from './context/BrewContext';
import { registerSW } from 'virtual:pwa-register';

if ('serviceWorker' in navigator) {
  // Register Vite PWA
  registerSW({ immediate: true });
}

const queryClient = new QueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || '186122113143-5ao2f53lkggo3a2jd3f5jo62v6tbc39j.apps.googleusercontent.com'}>
          <AuthProvider>
            <BrewProvider>
            <App />
          </BrewProvider>
          </AuthProvider>
        </GoogleOAuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);