import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useGoogleLogin } from '@react-oauth/google';
import { Lock, Mail, ArrowRight, Loader2, User, CheckCircle, Check, Smartphone } from 'lucide-react';
import * as api from '../services/api';
import { AuthShell } from './AuthShell';

// Criar conta no site. O uso e pelo app: aqui so se cria a conta (Google, Apple ou e-mail) e a pessoa
// segue para o app Breww. Nenhuma sessao fica aberta no site.

const APPLE_SERVICE_ID = import.meta.env.VITE_APPLE_SERVICE_ID as string | undefined; // Services ID da Apple (web)
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

const field = 'w-full bg-[var(--bg)] border border-black/[0.07] text-[#2b2f37] rounded-xl py-3.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-black/20 focus:border-black/30 transition-all placeholder-black/30 text-sm';
const icon = 'absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)] group-focus-within:text-[var(--ink)] transition-colors';
const socialBtn = 'w-full flex items-center justify-center gap-3 rounded-full border border-black/10 bg-white py-3.5 text-[15px] font-medium text-[var(--ink)] hover:bg-black/[0.03] transition-colors disabled:opacity-50';

type Done = { method: 'google' | 'apple' | 'email'; name?: string };

export const Register: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => { document.title = 'Criar conta — Breww'; }, []);

  const google = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const data = await api.loginWithGoogle(tokenResponse.access_token); // cria a conta (ou acha a existente)
        setDone({ method: 'google', name: data?.name });
      } catch (err: any) {
        toast.error(err?.message || 'Falha ao criar a conta com o Google');
      } finally { setLoading(false); }
    },
    onError: () => toast.error('Erro de comunicação com o Google'),
  });

  const apple = async () => {
    if (!APPLE_SERVICE_ID) return;
    setLoading(true);
    try {
      await loadAppleJs();
      const rawNonce = crypto.randomUUID();
      const AppleID = (window as any).AppleID;
      AppleID.auth.init({ clientId: APPLE_SERVICE_ID, scope: 'name email', redirectURI: `${window.location.origin}/register`, nonce: await sha256Hex(rawNonce), usePopup: true });
      const res = await AppleID.auth.signIn();
      const n = res?.user?.name;
      const fullName = n ? `${n.firstName || ''} ${n.lastName || ''}`.trim() : undefined;
      const data = await api.loginWithApple(res.authorization.id_token, rawNonce, fullName);
      setDone({ method: 'apple', name: data?.name });
    } catch (err: any) {
      if (err?.error === 'popup_closed_by_user') return;
      toast.error(err?.message || 'Falha ao criar a conta com a Apple');
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return void toast.error('Informe seu nome.');
    if (password.length < 6) return void toast.error('A senha deve ter pelo menos 6 caracteres.');
    if (password !== confirmPassword) return void toast.error('As senhas não conferem.');
    setLoading(true);
    try {
      await api.register(name.trim(), email.trim(), password);
      setDone({ method: 'email', name: name.trim() });
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar a conta');
    } finally { setLoading(false); }
  };

  if (done) {
    const how = done.method === 'google' ? 'Entrar com Google' : done.method === 'apple' ? 'Entrar com Apple' : 'seu e-mail e a senha que você criou';
    return (
      <AuthShell title="Conta pronta" subtitle={done.name ? `Tudo certo, ${done.name.split(' ')[0]}.` : 'Tudo certo.'}>
        <div className="space-y-6">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]"><Check size={28} className="text-[var(--ink)]" /></span>
          <div className="rounded-2xl bg-[var(--card)] p-6 text-white">
            <p className="flex items-center gap-2 font-medium"><Smartphone size={18} className="text-[var(--accent)]" /> Agora é no app Breww</p>
            <p className="mt-2 text-[15px] leading-relaxed text-[#c9ccd3]">Abra o app no celular e entre com <b className="text-white">{how}</b>. É a mesma conta.</p>
          </div>
          <p className="text-sm leading-relaxed text-[var(--muted)]">Ainda não montou o controlador? O <a href="/instalar" className="font-medium text-[var(--ink)] underline underline-offset-4">guia de montagem</a> mostra as peças e grava o firmware pelo navegador.</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Criar conta" subtitle="Grátis até 3 fermentadores. Depois é só entrar no app Breww com a mesma conta.">
      <div className="space-y-3">
        <button type="button" className={socialBtn} onClick={() => google()} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          Continuar com Google
        </button>
        {APPLE_SERVICE_ID && (
          <button type="button" className={`${socialBtn} border-[var(--ink)] bg-[var(--ink)] text-white hover:bg-black`} onClick={apple} disabled={loading}>
            <svg width="17" height="17" viewBox="0 0 17 20" fill="currentColor" aria-hidden="true"><path d="M14.2 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM11.6 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3-1.5z"/></svg>
            Continuar com Apple
          </button>
        )}
      </div>

      <div className="relative my-7 flex items-center justify-center">
        <div className="absolute inset-x-0 top-1/2 h-px bg-black/[0.07]" />
        <span className="relative bg-white px-3 text-xs text-[var(--muted)]">ou com e-mail</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="register-name" className="text-[10px] font-bold text-[var(--muted)] ml-1">Nome</label>
          <div className="relative group">
            <div className={icon}><User size={18} /></div>
            <input id="register-name" name="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required className={field} placeholder="Seu nome ou cervejaria" />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="register-email" className="text-[10px] font-bold text-[var(--muted)] ml-1">E-mail</label>
          <div className="relative group">
            <div className={icon}><Mail size={18} /></div>
            <input id="register-email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={field} placeholder="seu@email.com" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="register-password" className="text-[10px] font-bold text-[var(--muted)] ml-1">Senha</label>
            <div className="relative group">
              <div className={icon}><Lock size={16} /></div>
              <input id="register-password" name="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={field} placeholder="••••••" />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="register-confirm-password" className="text-[10px] font-bold text-[var(--muted)] ml-1">Confirmar</label>
            <div className="relative group">
              <div className={icon}><CheckCircle size={16} /></div>
              <input id="register-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} className={field} placeholder="••••••" />
            </div>
          </div>
        </div>
        <button type="submit" disabled={loading} className="w-full bg-[var(--ink)] hover:bg-black text-white font-semibold py-3.5 rounded-full transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed">
          {loading ? <Loader2 className="animate-spin" size={20} /> : <>Criar conta <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>}
        </button>
        <p className="text-center text-xs leading-relaxed text-[var(--muted)]">
          Ao criar a conta, você concorda com os{' '}
          <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-[#2b2f37] underline underline-offset-2">termos de uso</a>{' '}e a{' '}
          <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-[#2b2f37] underline underline-offset-2">política de privacidade</a>.
        </p>
      </form>

      <p className="mt-8 border-t border-black/[0.07] pt-6 text-center text-sm text-[var(--muted)]">Já tem conta? Entre pelo app Breww.</p>
    </AuthShell>
  );
};
