import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Smartphone, LogOut, Link2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { requestAppLoginCode } from '../services/api';
import { API_URL } from '../config';

// ============================================================================
// /app-login — login do app nativo (iOS/Android) pelo site.
// O app abre esta pagina numa janela segura do sistema com
//   ?redirect_uri=breww://auth (ou exp://... no Expo Go)&code_challenge=<PKCE>&state=<app>
// O usuario entra (Google por REDIRECIONAMENTO, sem popup, ou e-mail), confirma, e a pagina
// devolve um codigo de uso unico ao app. Ver backend/routes/appAuthRoutes.js.
// ============================================================================

const STORAGE_KEY = 'breww_app_login';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '186122113143-5ao2f53lkggo3a2jd3f5jo62v6tbc39j.apps.googleusercontent.com';

interface AppLoginParams {
    redirectUri: string;
    challenge: string;
    state: string;
    /** provider=google: o app tocou em "Continuar com Google" — vai direto ao Google e volta sozinho */
    provider?: string;
    googleState?: string;
}

/** Mesma regra do backend: so retornos para o app Breww (ou Expo Go em desenvolvimento). */
export const isAllowedAppRedirect = (uri: string) =>
    /^breww:\/\/[\w\-./]*$/.test(uri) || /^exps?:\/\/[\w\-.:]+(\/[\w\-./]*)?$/.test(uri);

const randomState = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
};

const loadParams = (): AppLoginParams | null => {
    const q = new URLSearchParams(window.location.search);
    const redirectUri = q.get('redirect_uri');
    const challenge = q.get('code_challenge');
    if (redirectUri && challenge) {
        const p: AppLoginParams = { redirectUri, challenge, state: q.get('state') || '', provider: q.get('provider') || '' };
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
        return p;
    }
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const AppLoginFlow: React.FC = () => {
    const { token, user, login, loginWithGoogle, logout } = useAuth();
    const [params] = useState<AppLoginParams | null>(loadParams);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const handledHash = useRef(false);
    const startedGoogle = useRef(false);
    const [autoContinue, setAutoContinue] = useState(false);

    const valid = useMemo(() => !!params && isAllowedAppRedirect(params.redirectUri) && /^[A-Za-z0-9_-]{43}$/.test(params.challenge), [params]);
    const direct = valid && params?.provider === 'google';

    // Volta do Google (fluxo por redirecionamento): #access_token=...&state=...
    useEffect(() => {
        if (handledHash.current || !params) return;
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = hash.get('access_token');
        if (!accessToken && !hash.get('error')) return;
        handledHash.current = true;
        window.history.replaceState(null, '', window.location.pathname);
        if (!accessToken || hash.get('state') !== params.googleState) {
            setError('Não foi possível entrar com o Google. Tente novamente.');
            return;
        }
        setBusy(true);
        loginWithGoogle(accessToken)
            .then(ok => { if (ok !== false && params.provider === 'google') setAutoContinue(true); })
            .catch(e => setError(e?.message || 'Falha ao entrar com o Google.'))
            .finally(() => setBusy(false));
    }, [params, loginWithGoogle]);

    const startGoogle = () => {
        if (!params) return;
        const googleState = randomState();
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...params, googleState })); } catch { /* ignore */ }
        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
        url.searchParams.set('redirect_uri', `${window.location.origin}/app-login`);
        url.searchParams.set('response_type', 'token');
        url.searchParams.set('scope', 'openid email profile');
        url.searchParams.set('state', googleState);
        url.searchParams.set('prompt', 'select_account');
        window.location.assign(url.toString());
    };

    const submitEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password) return setError('Informe e-mail e senha.');
        setBusy(true);
        setError(null);
        try {
            await login(email.trim(), password);
        } finally {
            setBusy(false);
        }
    };

    const continueToApp = async () => {
        if (!params || !token) return;
        setBusy(true);
        setError(null);
        try {
            const code = await requestAppLoginCode(token, params.redirectUri, params.challenge);
            try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
            const sep = params.redirectUri.includes('?') ? '&' : '?';
            window.location.assign(`${params.redirectUri}${sep}code=${encodeURIComponent(code)}&state=${encodeURIComponent(params.state)}`);
        } catch (e: any) {
            setError(e?.message || 'Não foi possível conectar o app.');
            setBusy(false);
        }
    };

    // "Continuar com Google" no app: vai direto ao Google (sem esta tela) ...
    useEffect(() => {
        if (!direct || startedGoogle.current) return;
        const hash = window.location.hash;
        if (hash.includes('access_token') || hash.includes('error')) return; // voltando do Google
        startedGoogle.current = true;
        startGoogle();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [direct]);

    // ... e, entrou, volta ao app sem pedir confirmacao
    useEffect(() => {
        if (autoContinue && token) { setAutoContinue(false); continueToApp(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoContinue, token]);

    if (direct && !error) {
        return (
            <div className="min-h-screen min-h-[100dvh] bg-[#050505] flex items-center justify-center p-6">
                <div className="flex items-center gap-2 text-neutral-400 text-sm"><Loader2 size={16} className="animate-spin" /> Entrando com o Google…</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen min-h-[100dvh] bg-[#050505] flex items-center justify-center p-6">
            <div className="w-full max-w-sm bg-neutral-900/50 border border-neutral-800 rounded-3xl p-7">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center mb-4">
                        <Smartphone size={22} />
                    </div>
                    <h1 className="text-white text-xl font-bold">Entrar no app Breww</h1>
                    <p className="text-neutral-400 text-sm mt-1">Use a mesma conta do site.</p>
                </div>

                {!valid ? (
                    <p className="text-red-400 text-sm text-center">
                        Link de login inválido. Abra esta página pelo botão de login do app.
                    </p>
                ) : token ? (
                    <div className="space-y-3">
                        <p className="text-neutral-300 text-sm text-center">
                            Conectar o app à conta <span className="text-white font-medium">{user || 'atual'}</span>?
                        </p>
                        <button
                            type="button"
                            onClick={continueToApp}
                            disabled={busy}
                            className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-neutral-200 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                        >
                            {busy && <Loader2 size={16} className="animate-spin" />} Continuar no app
                        </button>
                        <button
                            type="button"
                            onClick={logout}
                            disabled={busy}
                            className="w-full text-neutral-400 hover:text-white text-sm py-2 inline-flex items-center justify-center gap-2"
                        >
                            <LogOut size={14} /> Usar outra conta
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <button
                            type="button"
                            onClick={startGoogle}
                            disabled={busy}
                            className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-neutral-200 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                        >
                            {busy && <Loader2 size={16} className="animate-spin" />} Entrar com Google
                        </button>
                        <div className="flex items-center gap-3 text-neutral-600 text-xs">
                            <span className="flex-1 h-px bg-neutral-800" /> ou com e-mail <span className="flex-1 h-px bg-neutral-800" />
                        </div>
                        <form onSubmit={submitEmail} className="space-y-3">
                            <input
                                type="email"
                                autoComplete="email"
                                placeholder="E-mail"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-neutral-600"
                            />
                            <input
                                type="password"
                                autoComplete="current-password"
                                placeholder="Senha"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-neutral-600"
                            />
                            <button
                                type="submit"
                                disabled={busy}
                                className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-3 rounded-xl disabled:opacity-60"
                            >
                                Entrar
                            </button>
                        </form>
                    </div>
                )}

                {error && <p className="text-red-400 text-sm text-center mt-4" aria-live="polite">{error}</p>}
            </div>
        </div>
    );
};

// ============================================================================
// /app-login?mode=link — vincular o Google a uma conta ja aberta no app.
// O app manda um bilhete de uso unico (preso a conta). A pagina mostra a conta, o usuario
// confirma, entra no Google e o vinculo e feito; depois volta ao app com ?status=linked.
// Ver backend/routes/identityRoutes.js.
// ============================================================================

const LINK_KEY = 'breww_app_link';

interface AppLinkParams {
    ticket: string;
    redirectUri: string;
    state: string;
    googleState?: string;
}

const loadLinkParams = (): AppLinkParams | null => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('mode') === 'link') {
        const p: AppLinkParams = { ticket: q.get('ticket') || '', redirectUri: q.get('redirect_uri') || '', state: q.get('state') || '' };
        try { sessionStorage.setItem(LINK_KEY, JSON.stringify(p)); } catch { /* ignore */ }
        return p;
    }
    // Volta do Google: so vale se o state do Google bater com o guardado para o vinculo
    const hashState = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('state');
    try {
        const raw = sessionStorage.getItem(LINK_KEY);
        const p: AppLinkParams | null = raw ? JSON.parse(raw) : null;
        return p && hashState && p.googleState === hashState ? p : null;
    } catch {
        return null;
    }
};

const AppLink: React.FC<{ initial: AppLinkParams }> = ({ initial }) => {
    const [params] = useState<AppLinkParams>(initial);
    const [account, setAccount] = useState<{ name: string; email: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const handledHash = useRef(false);
    const valid = isAllowedAppRedirect(params.redirectUri) && /^[A-Za-z0-9_-]{20,64}$/.test(params.ticket);

    const backToApp = (query: string) => {
        try { sessionStorage.removeItem(LINK_KEY); } catch { /* ignore */ }
        const sep = params.redirectUri.includes('?') ? '&' : '?';
        window.location.assign(`${params.redirectUri}${sep}${query}&state=${encodeURIComponent(params.state)}`);
    };

    // Conta do bilhete (antes de ir ao Google)
    useEffect(() => {
        if (!valid || window.location.hash.includes('access_token')) return;
        fetch(`${API_URL}/auth/link-ticket/${encodeURIComponent(params.ticket)}`)
            .then(async r => {
                const d = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(d.error || 'Link expirado. Volte ao app e tente de novo.');
                setAccount({ name: d.name, email: d.email });
            })
            .catch(e => setError(e.message));
    }, [valid, params.ticket]);

    // Volta do Google: faz o vinculo e devolve ao app
    useEffect(() => {
        if (handledHash.current || !valid) return;
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = hash.get('access_token');
        if (!accessToken && !hash.get('error')) return;
        handledHash.current = true;
        window.history.replaceState(null, '', window.location.pathname);
        if (!accessToken || hash.get('state') !== params.googleState) {
            backToApp(`error=${encodeURIComponent('Vínculo com o Google cancelado.')}`);
            return;
        }
        setBusy(true);
        fetch(`${API_URL}/auth/link/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticket: params.ticket, accessToken }),
        })
            .then(async r => {
                const d = await r.json().catch(() => ({}));
                backToApp(r.ok ? 'status=linked' : `error=${encodeURIComponent(d.error || 'Não foi possível vincular o Google.')}`);
            })
            .catch(() => backToApp(`error=${encodeURIComponent('Sem conexão. Tente de novo.')}`));
    }, [valid, params]);

    const startGoogle = () => {
        const googleState = randomState();
        try { sessionStorage.setItem(LINK_KEY, JSON.stringify({ ...params, googleState })); } catch { /* ignore */ }
        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
        url.searchParams.set('redirect_uri', `${window.location.origin}/app-login`);
        url.searchParams.set('response_type', 'token');
        url.searchParams.set('scope', 'openid email profile');
        url.searchParams.set('state', googleState);
        url.searchParams.set('prompt', 'select_account');
        window.location.assign(url.toString());
    };

    return (
        <div className="min-h-screen min-h-[100dvh] bg-[#050505] flex items-center justify-center p-6">
            <div className="w-full max-w-sm bg-neutral-900/50 border border-neutral-800 rounded-3xl p-7">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center mb-4">
                        <Link2 size={22} />
                    </div>
                    <h1 className="text-white text-xl font-bold">Vincular o Google</h1>
                    <p className="text-neutral-400 text-sm mt-1">Depois você poderá entrar com o Google nesta mesma conta.</p>
                </div>

                {!valid ? (
                    <p className="text-red-400 text-sm text-center">Link inválido. Abra esta página pelo app, em Minha conta.</p>
                ) : busy ? (
                    <div className="flex items-center justify-center gap-2 text-neutral-300 text-sm"><Loader2 size={16} className="animate-spin" /> Vinculando…</div>
                ) : account ? (
                    <div className="space-y-3">
                        <p className="text-neutral-300 text-sm text-center">
                            Conta Breww: <span className="text-white font-medium">{account.name}</span>
                            <br /><span className="text-neutral-500">{account.email}</span>
                        </p>
                        <button
                            type="button"
                            onClick={startGoogle}
                            className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-neutral-200 inline-flex items-center justify-center gap-2"
                        >
                            Continuar com Google
                        </button>
                        <button
                            type="button"
                            onClick={() => backToApp(`error=${encodeURIComponent('Vínculo com o Google cancelado.')}`)}
                            className="w-full text-neutral-400 hover:text-white text-sm py-2"
                        >
                            Cancelar
                        </button>
                    </div>
                ) : !error ? (
                    <div className="flex justify-center"><Loader2 size={18} className="animate-spin text-neutral-500" /></div>
                ) : null}

                {error && <p className="text-red-400 text-sm text-center mt-4" aria-live="polite">{error}</p>}
            </div>
        </div>
    );
};

export const AppLogin: React.FC = () => {
    const [link] = useState<AppLinkParams | null>(loadLinkParams);
    return link ? <AppLink initial={link} /> : <AppLoginFlow />;
};
