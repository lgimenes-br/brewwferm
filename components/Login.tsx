import React, { useState, useEffect } from 'react';
import { Lock, Mail, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AuthShell, authInput, authLabel } from './AuthShell';
import { useGoogleLogin } from '@react-oauth/google';
import { requestPasswordReset, confirmPasswordReset } from '../services/api';
import toast from 'react-hot-toast';

export const Login: React.FC = () => {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Password Recovery Modal State
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'verify'>('request');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const success = await loginWithGoogle(tokenResponse.access_token);
        if (success) navigate('/');
      } catch (err: any) {
        toast.error(err.message || 'Falha ao autenticar com o Google');
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      toast.error('Erro de comunicação com o Google');
    }
  });

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setLoading(true);
        loginWithGoogle(token)
          .then(success => {
            setLoading(false);
            if (success) navigate('/');
          })
          .catch(err => {
            setLoading(false);
            toast.error(err.message || 'Falha ao autenticar com o Google via Redirecionamento');
          });
      }
    }

    // Deep-link support for password reset links (/#/login?reset=1&email=...&code=...)
    const queryIdx = hash.indexOf('?');
    const queryStr = queryIdx >= 0 ? hash.slice(queryIdx + 1) : window.location.search.slice(1);
    if (queryStr) {
      const qParams = new URLSearchParams(queryStr);
      if (qParams.get('reset') === '1') {
        const qEmail = qParams.get('email') || '';
        const qCode = qParams.get('code') || '';
        if (qEmail) setRecoveryEmail(qEmail);
        if (qCode) setRecoveryCode(qCode);
        setRecoveryStep(qCode ? 'verify' : 'request');
        setIsRecoveryOpen(true);
      }
    }
  }, [loginWithGoogle, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Preencha email e senha');
      return;
    }
    setLoading(true);
    try {
      const success = await login(email.trim(), password);
      if (success) navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const openRecoveryModal = () => {
    setRecoveryEmail(email.trim());
    setRecoveryCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setRecoveryStep('request');
    setIsRecoveryOpen(true);
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim() || !recoveryEmail.includes('@')) {
      toast.error('Informe um e-mail válido');
      return;
    }
    setRecoveryLoading(true);
    try {
      const res = await requestPasswordReset(recoveryEmail.trim());
      toast.success(res.message || 'Código enviado!');
      setRecoveryStep('verify');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao solicitar código');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim() || !recoveryCode.trim() || !newPassword) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setRecoveryLoading(true);
    try {
      const res = await confirmPasswordReset(recoveryEmail.trim(), recoveryCode.trim(), newPassword);
      toast.success(res.message || 'Senha redefinida com sucesso!');
      setEmail(recoveryEmail.trim());
      setPassword('');
      setIsRecoveryOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Código inválido ou expirado');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const googleIcon = (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
  const iconBox = 'pointer-events-none absolute inset-y-0 left-0 pl-4 flex items-center text-[var(--tertiary)] group-focus-within:text-[var(--ink)] transition-colors';

  // Recuperar a senha: uma etapa desta mesma tela (nao um modal por cima)
  if (isRecoveryOpen) {
    return (
      <AuthShell
        title="Recuperar senha"
        subtitle={recoveryStep === 'request' ? 'Enviamos um código de 6 dígitos para o e-mail da sua conta.' : 'Digite o código que chegou e escolha a nova senha.'}
      >
        {recoveryStep === 'request' ? (
          <form onSubmit={handleRequestCode} className="flex flex-col gap-5">
            <div>
              <label htmlFor="recovery-email" className={authLabel}>E-mail da conta</label>
              <div className="relative group">
                <span className={iconBox}><Mail size={18} /></span>
                <input id="recovery-email" type="email" required autoComplete="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="seu@email.com" className={authInput} />
              </div>
              <p className="mt-2 px-1 text-[13px] text-[var(--tertiary)]">O código também chega pelo celular e pelo Telegram, se estiverem ligados na sua conta.</p>
            </div>
            <button type="submit" disabled={recoveryLoading} className="app-btn w-full !min-h-12">
              {recoveryLoading ? <Loader2 size={18} className="animate-spin" /> : 'Enviar código'}
            </button>
            <button type="button" onClick={() => setRecoveryStep('verify')} className="self-center min-h-11 px-3 text-[15px] text-[var(--muted)] hover:text-[var(--ink)]">Já tenho um código</button>
          </form>
        ) : (
          <form onSubmit={handleConfirmReset} className="flex flex-col gap-5">
            <div>
              <label htmlFor="recovery-verify-email" className={authLabel}>E-mail</label>
              <div className="relative group">
                <span className={iconBox}><Mail size={18} /></span>
                <input id="recovery-verify-email" type="email" required autoComplete="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} className={authInput} />
              </div>
            </div>
            <div>
              <label htmlFor="recovery-code" className={authLabel}>Código de 6 dígitos</label>
              <input
                id="recovery-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required
                value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, ''))} placeholder="000000"
                className="w-full h-14 rounded-full bg-[var(--cell-2)] border border-[var(--line)] px-4 text-center text-[24px] tabular tracking-[0.3em] text-[var(--ink)] placeholder:text-[var(--tertiary)] focus:outline-none focus:border-[rgba(113,252,143,0.55)]"
              />
            </div>
            <div>
              <label htmlFor="recovery-new-password" className={authLabel}>Nova senha <span className="text-[var(--tertiary)]">(mín. 6 caracteres)</span></label>
              <div className="relative group">
                <span className={iconBox}><Lock size={18} /></span>
                <input id="recovery-new-password" type="password" required autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className={authInput} />
              </div>
            </div>
            <div>
              <label htmlFor="recovery-confirm-password" className={authLabel}>Confirmar a nova senha</label>
              <div className="relative group">
                <span className={iconBox}><Lock size={18} /></span>
                <input id="recovery-confirm-password" type="password" required autoComplete="new-password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="••••••••" className={authInput} />
              </div>
            </div>
            <button type="submit" disabled={recoveryLoading} className="app-btn w-full !min-h-12">
              {recoveryLoading ? <Loader2 size={18} className="animate-spin" /> : 'Redefinir senha'}
            </button>
            <button type="button" onClick={() => setRecoveryStep('request')} className="self-center min-h-11 px-3 text-[15px] text-[var(--muted)] hover:text-[var(--ink)]">Reenviar o código</button>
          </form>
        )}
        <button type="button" onClick={() => setIsRecoveryOpen(false)} className="mt-6 inline-flex min-h-11 items-center gap-2 text-[15px] text-[var(--muted)] hover:text-[var(--ink)]">
          <ArrowLeft size={16} aria-hidden /> Voltar para entrar
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Entrar" subtitle="Acompanhe e controle seus fermentadores.">
      {/* O caminho mais rapido primeiro */}
      <button type="button" onClick={() => googleLogin()} className="app-btn-quiet w-full !min-h-12 gap-3">
        {googleIcon} Entrar com Google
      </button>

      <div className="my-6 flex items-center gap-3 text-[13px] text-[var(--tertiary)]" aria-hidden>
        <span className="h-px flex-1 bg-[var(--line)]" /> ou com e-mail <span className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label htmlFor="login-email" className={authLabel}>E-mail</label>
          <div className="relative group">
            <span className={iconBox}><Mail size={18} /></span>
            <input id="login-email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={authInput} placeholder="seu@email.com" />
          </div>
        </div>

        <div>
          <label htmlFor="login-password" className={authLabel}>Senha</label>
          <div className="relative group">
            <span className={iconBox}><Lock size={18} /></span>
            <input id="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className={authInput} placeholder="••••••••" />
          </div>
          <div className="mt-1 flex justify-end">
            <button type="button" onClick={openRecoveryModal} className="min-h-11 px-1 text-[14px] text-[var(--muted)] hover:text-[var(--ink)]">Esqueci minha senha</button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="app-btn w-full !min-h-12 group">
          {loading ? <Loader2 className="animate-spin" size={20} /> : <>Entrar <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" aria-hidden /></>}
        </button>
      </form>

      <p className="mt-8 text-center text-[15px] text-[var(--muted)]">
        Novo por aqui?{' '}
        <button type="button" onClick={() => navigate('/register')} className="min-h-11 font-medium text-[var(--ink)] underline decoration-white/30 underline-offset-4 hover:decoration-white">Criar conta</button>
      </p>
    </AuthShell>
  );
};
