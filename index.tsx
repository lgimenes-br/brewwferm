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

// Pagina aberta antes de um deploy pede um pedaco (chunk) que nao existe mais: em vez de quebrar a tela
// ("'text/html' is not a valid JavaScript MIME type", Sentry 18/11/2026), recarrega uma vez na versao nova.
// A marca na sessao evita recarregar em loop se o problema for outro.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const KEY = 'breww-chunk-reload';
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 60000) return; // ja recarregou ha menos de 1 min: deixa o erro aparecer
    sessionStorage.setItem(KEY, String(Date.now()));
    event.preventDefault();
    window.location.reload();
  } catch { /* sem sessionStorage: segue o erro normal */ }
});

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