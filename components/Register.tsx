
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Lock, Mail, ArrowRight, Loader2, User, CheckCircle } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AuthShell } from './AuthShell';

export const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Por favor, informe seu nome.');
      return;
    }
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não conferem');
      return;
    }
    setLoading(true);
    try {
      const success = await register(name.trim(), email.trim(), password);
      if (success) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Criar conta" subtitle="Grátis até 3 fermentadores. Leva um minuto.">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="register-name" className="text-[10px] font-bold text-[var(--muted)] ml-1">Nome Completo</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)] group-focus-within:text-[var(--ink)] transition-colors">
                <User size={18} />
              </div>
              <input
                id="register-name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-[var(--bg)] border border-black/[0.07] text-[#2b2f37] rounded-xl py-3.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-black/20 focus:border-black/30 transition-all placeholder-black/30 text-sm"
                placeholder="Seu nome ou cervejaria"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="register-email" className="text-[10px] font-bold text-[var(--muted)] ml-1">Email</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)] group-focus-within:text-[var(--ink)] transition-colors">
                <Mail size={18} />
              </div>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[var(--bg)] border border-black/[0.07] text-[#2b2f37] rounded-xl py-3.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-black/20 focus:border-black/30 transition-all placeholder-black/30 text-sm"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="register-password" className="text-[10px] font-bold text-[var(--muted)] ml-1">Senha</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)] group-focus-within:text-[var(--ink)] transition-colors">
                  <Lock size={16} />
                </div>
                <input
                  id="register-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-[var(--bg)] border border-black/[0.07] text-[#2b2f37] rounded-xl py-3.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-black/20 focus:border-black/30 transition-all placeholder-black/30 text-sm"
                  placeholder="••••••"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="register-confirm-password" className="text-[10px] font-bold text-[var(--muted)] ml-1">Confirmar</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)] group-focus-within:text-[var(--ink)] transition-colors">
                  <CheckCircle size={16} />
                </div>
                <input
                  id="register-confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full bg-[var(--bg)] border border-black/[0.07] text-[#2b2f37] rounded-xl py-3.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-black/20 focus:border-black/30 transition-all placeholder-black/30 text-sm"
                  placeholder="••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--ink)] hover:bg-black text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed mt-6"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                Criar conta
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
          <p className="mt-4 text-center text-xs leading-relaxed text-[var(--muted)]">
            Ao criar a conta, você concorda com os{' '}
            <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-[#2b2f37] underline underline-offset-2">termos de uso</a>{' '}e a{' '}
            <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-[#2b2f37] underline underline-offset-2">política de privacidade</a>.
          </p>
        </form>

        <div className="mt-6 text-center pt-6 border-t border-black/[0.07]">
          <p className="text-[var(--muted)] text-xs">
            Já possui uma conta?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-[var(--ink)] hover:text-[#2b2f37] font-bold underline underline-offset-4 transition-colors ml-1"
            >
              Fazer Login
            </button>
          </p>
        </div>
    </AuthShell>
  );
};
