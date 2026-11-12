import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrewProvider } from './context/BrewContext';
import { registerSW } from 'virtual:pwa-register';
import * as Sentry from '@sentry/react';
import './index.css';

// Monitor de erros (Sentry): so com VITE_SENTRY_DSN no build. Sem dados pessoais (nada de e-mail, IP ou corpo).
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) { delete event.request.cookies; delete event.request.headers; }
      if (event.user) event.user = event.user.id ? { id: String(event.user.id) } : undefined;
      return event;
    },
  });
}

// /app-login roda dentro da janela de login do app: ali o PWA nao pode se atualizar e recarregar
// a pagina no meio do retorno do Google (cortava o login com "Load failed").
if ('serviceWorker' in navigator && !window.location.pathname.startsWith('/app-login')) {
  // Register Vite PWA (which includes push-sw.js via importScripts)
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