// Monitor de erros (Sentry). Importado na primeira linha do server.js. Sem SENTRY_DSN no .env, nao faz nada.
// Sem dados pessoais: nada de e-mail, IP, token ou corpo de requisicao; do usuario so o id.
import 'dotenv/config';
import * as Sentry from '@sentry/node';

export const sentryEnabled = !!process.env.SENTRY_DSN;

if (sentryEnabled) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENV || 'production',
        release: process.env.APP_RELEASE || undefined,
        sendDefaultPii: false,
        tracesSampleRate: 0,
        // os erros tratados com console.error (respostas 500) tambem chegam
        integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
        beforeSend(event) {
            if (event.request) {
                delete event.request.data;
                delete event.request.cookies;
                delete event.request.query_string;
                if (event.request.headers) for (const h of Object.keys(event.request.headers)) if (/authorization|cookie|x-forwarded-for|x-real-ip/i.test(h)) delete event.request.headers[h];
            }
            if (event.user) event.user = event.user.id ? { id: String(event.user.id) } : undefined;
            return event;
        },
    });
    console.log('🛰️ [Sentry] Monitor de erros ligado');
}

export { Sentry };
