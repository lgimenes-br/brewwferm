import React, { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import * as api from '../../services/api';
import { APPLE_SERVICE_ID, signInWithApple } from '../../services/socialAuth';
import { GoogleIcon, AppleIcon } from '../SocialIcons';

// Primeira etapa do assistente: entrar ou criar a conta. No fim da instalacao o aparelho entra
// nessa conta sozinho, sem codigo. A sessao vale so para o assistente (nao abre o painel do site).

export type InstallSession = { token: string; name: string };

const social = 'flex min-h-11 w-full items-center justify-center gap-3 rounded-full border border-[var(--line-strong)] bg-[var(--fill)] px-5 text-[15px] font-medium text-[var(--ink)] transition hover:bg-white/10 disabled:opacity-50';
const input = 'mt-1.5 w-full rounded-full border border-[var(--line)] bg-[var(--cell-2)] px-5 h-11 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--tertiary)] focus:border-[rgba(113,252,143,0.55)]';
const label = 'block text-sm text-[var(--muted)]';

export const AccountStep: React.FC<{
    session: InstallSession | null;
    onSession: (s: InstallSession | null) => void;
    onContinue: () => void;
    heading: React.ReactNode;
}> = ({ session, onSession, onContinue, heading }) => {
    const [mode, setMode] = useState<'entrar' | 'criar'>('criar');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState<'google' | 'apple' | 'email' | null>(null);
    const [error, setError] = useState('');

    const finish = (data: any, fallbackName: string) => {
        if (!data?.token) throw new Error('Não foi possível entrar.');
        onSession({ token: data.token, name: data.name || fallbackName });
    };

    const google = useGoogleLogin({
        onSuccess: async (r) => {
            setBusy('google'); setError('');
            try { finish(await api.loginWithGoogle(r.access_token), 'você'); } catch (e: any) { setError(e?.message || 'Falha ao entrar com o Google.'); } finally { setBusy(null); }
        },
        onError: () => setError('Erro de comunicação com o Google.'),
    });

    const apple = async () => {
        setBusy('apple'); setError('');
        try { const data = await signInWithApple('/instalar/assistente'); if (data) finish(data, 'você'); } catch (e: any) { setError(e?.message || 'Falha ao entrar com a Apple.'); } finally { setBusy(null); }
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (mode === 'criar' && !name.trim()) return setError('Informe seu nome.');
        if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.');
        setBusy('email');
        try {
            if (mode === 'criar') await api.register(name.trim(), email.trim(), password);
            finish(await api.login(email.trim(), password), name.trim() || email.trim());
        } catch (err: any) {
            const msg = String(err?.message || '');
            setError(mode === 'entrar' && /login failed|inv[aá]lid|incorret/i.test(msg) ? 'E-mail ou senha não conferem.' : msg || 'Não foi possível continuar.');
        } finally { setBusy(null); }
    };

    if (session) {
        return (
            <div className="space-y-6">
                {heading}
                <div className="flex flex-wrap items-center gap-4 rounded-[22px] border border-[var(--line)] bg-[var(--cell-2)] p-5 sm:p-6">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]"><Check size={20} className="text-[var(--on-accent)]" /></span>
                    <div className="min-w-0 flex-1">
                        <p className="font-medium">Conectado como {session.name}</p>
                        <p className="mt-0.5 text-sm text-[var(--muted)]">O aparelho entra nesta conta no fim da instalação.</p>
                    </div>
                    <button type="button" className="inline-flex min-h-11 items-center text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--ink)]" onClick={() => onSession(null)}>Trocar de conta</button>
                </div>
                <button type="button" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-[15px] font-semibold text-[var(--on-accent)] hover:brightness-95" onClick={onContinue}>
                    Continuar <ArrowRight size={18} />
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {heading}
            <div className="max-w-xl grid gap-2 sm:grid-cols-2">
                <button type="button" className={social} onClick={() => google()} disabled={!!busy}>
                    {busy === 'google' ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />} Continuar com Google
                </button>
                {APPLE_SERVICE_ID && (
                    <button type="button" className={social} onClick={apple} disabled={!!busy}>
                        {busy === 'apple' ? <Loader2 size={18} className="animate-spin" /> : <AppleIcon />} Continuar com Apple
                    </button>
                )}
            </div>

            <div className="flex max-w-xl items-center gap-3 text-[13px] text-[var(--tertiary)]" aria-hidden>
                <span className="h-px flex-1 bg-[var(--line)]" /> ou com e-mail <span className="h-px flex-1 bg-[var(--line)]" />
            </div>

            <form onSubmit={submit} className="max-w-xl space-y-3.5" noValidate>
                <div role="group" aria-label="Conta" className="grid max-w-sm grid-cols-2 rounded-full border border-[var(--line)] bg-[var(--cell-2)] p-1 text-[15px]">
                    {(['criar', 'entrar'] as const).map(m => (
                        <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setError(''); }}
                            className={`min-h-10 rounded-full font-medium transition ${mode === m ? 'bg-[var(--fill)] text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
                            {m === 'criar' ? 'Criar conta' : 'Já tenho conta'}
                        </button>
                    ))}
                </div>
                {/* Campos em duas colunas no computador, para o passo caber na janela sem rolar */}
                <div className="grid gap-3.5 sm:grid-cols-2">
                    {mode === 'criar' && (
                        <label className={label}>Nome
                            <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" className={input} placeholder="Seu nome ou cervejaria" />
                        </label>
                    )}
                    <label className={label}>E-mail
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required className={input} placeholder="seu@email.com" />
                    </label>
                    <label className={label}>
                        <span className="flex items-center justify-between gap-3">
                            <span>Senha{mode === 'criar' && <span className="text-[var(--tertiary)]"> · mín. 6 caracteres</span>}</span>
                            {mode === 'entrar' && <a href="/login?reset=1" target="_blank" rel="noopener noreferrer" className="text-[var(--muted)] underline underline-offset-4 hover:text-[var(--ink)]">Esqueci a senha</a>}
                        </span>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'criar' ? 'new-password' : 'current-password'} required minLength={6} className={input} />
                    </label>
                    <div className="flex items-end">
                        <button type="submit" disabled={!!busy || !email.trim() || !password} className="app-btn w-full !min-h-11">
                            {busy === 'email' ? <Loader2 size={18} className="animate-spin" /> : null}{mode === 'criar' ? 'Criar conta e continuar' : 'Entrar e continuar'}
                        </button>
                    </div>
                </div>
                {error && <p role="alert" className="rounded-[18px] border border-[rgba(255,90,110,0.35)] bg-[rgba(255,90,110,0.10)] px-4 py-3 text-[15px] text-[#FF8F9C]">{error}</p>}
            </form>
            <p className="max-w-xl text-pretty text-[13px] text-[var(--tertiary)]">
                Grátis até 3 fermentadores. É a mesma conta do app Breww. Ao continuar, você aceita os <a href="/termos" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Termos</a> e a <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Privacidade</a>.
            </p>
        </div>
    );
};
