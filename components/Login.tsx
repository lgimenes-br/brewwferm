import React, { useState, useEffect } from 'react';
import { Lock, Mail, ArrowRight, Loader2, KeyRound, X, CheckCircle2 } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
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

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience - Monochrome/Subtle */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neutral-800/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neutral-800/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="bg-neutral-900/30 backdrop-blur-sm border border-neutral-800 p-8 rounded-3xl shadow-2xl w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-baseline mb-2">
            <span className="text-5xl font-black text-white tracking-tighter">BREW</span>
            <div className="relative">
              <span className="text-5xl font-black text-white tracking-tighter">W</span>
              <div className="absolute top-0 -right-2 w-3 h-2 bg-white rounded-tr-sm"></div>
            </div>
          </div>
          <p className="text-neutral-400 text-sm mt-1 uppercase tracking-widest font-bold">Smart Brewing</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="login-email" className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Email</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-white transition-colors">
                <Mail size={18} />
              </div>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-black/50 border border-neutral-800 text-neutral-100 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500 transition-all placeholder-neutral-700"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
              <label htmlFor="login-password" className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Senha</label>
              <button
                type="button"
                onClick={openRecoveryModal}
                className="text-[11px] font-medium text-neutral-400 hover:text-white underline underline-offset-4 transition-colors"
              >
                Esqueci minha senha
              </button>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-white transition-colors">
                <Lock size={18} />
              </div>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-black/50 border border-neutral-800 text-neutral-100 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500 transition-all placeholder-neutral-700"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-neutral-100 hover:bg-white text-black font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed mt-4"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                Entrar
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-800"></div>
            </div>
            <div className="relative px-3 bg-black text-[10px] text-neutral-600 font-bold uppercase tracking-widest">
              Ou entrar com
            </div>
          </div>

          <button
            type="button"
            onClick={() => googleLogin()}
            className="w-full bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 group"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Entrar com Google
          </button>
        </div>

        <div className="mt-8 text-center pt-6 border-t border-neutral-800/50">
          <p className="text-neutral-500 text-sm">
            Novo por aqui? <button type="button" onClick={() => navigate('/register')} className="text-neutral-300 hover:text-white font-medium underline underline-offset-4 transition-colors">Criar conta</button>
          </p>
        </div>
      </div>

      {/* Password Recovery Modal */}
      {isRecoveryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="recovery-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsRecoveryOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setIsRecoveryOpen(false); }}
        >
          <div
            className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-white">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h2 id="recovery-modal-title" className="text-base font-bold text-white">Recuperar Senha</h2>
                  <p className="text-xs text-neutral-500">
                    {recoveryStep === 'request'
                      ? 'Enviaremos um código de 6 dígitos para sua conta'
                      : 'Digite o código de 6 dígitos e sua nova senha'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Fechar modal de recuperação"
                onClick={() => setIsRecoveryOpen(false)}
                className="text-neutral-500 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {recoveryStep === 'request' ? (
              <form onSubmit={handleRequestCode} className="space-y-4">
                <div>
                  <label htmlFor="recovery-email" className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                    E-mail da Conta
                  </label>
                  <input
                    id="recovery-email"
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-black border border-neutral-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  O código de 6 dígitos será enviado por e-mail e também entregue instantaneamente via WebPush e Bot do Telegram (caso configurados na sua conta).
                </p>
                <div className="flex items-center justify-between pt-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRecoveryStep('verify')}
                    className="text-xs text-neutral-400 hover:text-white underline underline-offset-4"
                  >
                    Já tenho um código
                  </button>
                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="px-5 py-2.5 bg-white hover:bg-neutral-200 text-black font-bold text-sm rounded-xl transition-colors flex items-center gap-2 disabled:opacity-60"
                  >
                    {recoveryLoading ? <Loader2 size={16} className="animate-spin" /> : 'Enviar Código'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} className="space-y-4">
                <div>
                  <label htmlFor="recovery-verify-email" className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                    E-mail
                  </label>
                  <input
                    id="recovery-verify-email"
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    className="w-full bg-black border border-neutral-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <div>
                  <label htmlFor="recovery-code" className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                    Código de 6 Dígitos
                  </label>
                  <input
                    id="recovery-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full bg-black border border-neutral-800 text-white rounded-xl px-4 py-3 text-center font-mono text-lg tracking-[0.35em] focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <div>
                  <label htmlFor="recovery-new-password" className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                    Nova Senha (mín. 6 caracteres)
                  </label>
                  <input
                    id="recovery-new-password"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black border border-neutral-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <div>
                  <label htmlFor="recovery-confirm-password" className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                    Confirmar Nova Senha
                  </label>
                  <input
                    id="recovery-confirm-password"
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black border border-neutral-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <div className="flex items-center justify-between pt-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRecoveryStep('request')}
                    className="text-xs text-neutral-400 hover:text-white underline underline-offset-4"
                  >
                    Reenviar código
                  </button>
                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="px-5 py-2.5 bg-white hover:bg-neutral-200 text-black font-bold text-sm rounded-xl transition-colors flex items-center gap-2 disabled:opacity-60"
                  >
                    {recoveryLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> Redefinir Senha
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
