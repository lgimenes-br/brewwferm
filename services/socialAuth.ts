// Login com a Apple no navegador (popup do Apple JS), usado no cadastro e no assistente de instalacao.
// So aparece quando VITE_APPLE_SERVICE_ID esta configurado.
import * as api from './api';

export const APPLE_SERVICE_ID = import.meta.env.VITE_APPLE_SERVICE_ID as string | undefined;
const APPLE_JS = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/pt_BR/appleid.auth.js';

const sha256Hex = async (text: string) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const loadAppleJs = () => new Promise<void>((resolve, reject) => {
    if ((window as any).AppleID) return resolve();
    const s = document.createElement('script');
    s.src = APPLE_JS; s.async = true;
    s.onload = () => resolve(); s.onerror = () => reject(new Error('Não foi possível carregar o login da Apple.'));
    document.head.appendChild(s);
});

/** Abre o popup da Apple e entra (ou cria a conta). Retorna null se a pessoa fechou o popup. */
export const signInWithApple = async (redirectPath: string) => {
    if (!APPLE_SERVICE_ID) throw new Error('Login com a Apple indisponível.');
    await loadAppleJs();
    const rawNonce = crypto.randomUUID();
    const AppleID = (window as any).AppleID;
    AppleID.auth.init({ clientId: APPLE_SERVICE_ID, scope: 'name email', redirectURI: `${window.location.origin}${redirectPath}`, nonce: await sha256Hex(rawNonce), usePopup: true });
    try {
        const res = await AppleID.auth.signIn();
        const n = res?.user?.name;
        const fullName = n ? `${n.firstName || ''} ${n.lastName || ''}`.trim() : undefined;
        return await api.loginWithApple(res.authorization.id_token, rawNonce, fullName);
    } catch (err: any) {
        if (err?.error === 'popup_closed_by_user') return null;
        throw err;
    }
};
