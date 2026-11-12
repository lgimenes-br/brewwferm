
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Lock, Mail, ArrowRight, Loader2, User, CheckCircle } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

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
          <h1 className="text-neutral-400 text-xs mt-1 uppercase tracking-widest font-bold">Criar Nova Conta • Smart Brewing</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="register-name" className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Nome Completo</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-white transition-colors">
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
                className="w-full bg-black/50 border border-neutral-800 text-neutral-100 rounded-xl py-3.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500 transition-all placeholder-neutral-700 text-sm"
                placeholder="Seu nome ou cervejaria"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="register-email" className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Email</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-white transition-colors">
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
                className="w-full bg-black/50 border border-neutral-800 text-neutral-100 rounded-xl py-3.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500 transition-all placeholder-neutral-700 text-sm"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="register-password" className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Senha</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-white transition-colors">
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
                  className="w-full bg-black/50 border border-neutral-800 text-neutral-100 rounded-xl py-3.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500 transition-all placeholder-neutral-700 text-sm"
                  placeholder="••••••"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="register-confirm-password" className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Confirmar</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-white transition-colors">
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
                  className="w-full bg-black/50 border border-neutral-800 text-neutral-100 rounded-xl py-3.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500 transition-all placeholder-neutral-700 text-sm"
                  placeholder="••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white hover:bg-neutral-200 text-black font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed mt-6"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                Confirmar Registro
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
          <p className="mt-4 text-center text-xs leading-relaxed text-neutral-500">
            Ao criar a conta, você concorda com os{' '}
            <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-neutral-300 underline underline-offset-2">termos de uso</a>{' '}e a{' '}
            <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-neutral-300 underline underline-offset-2">política de privacidade</a>.
          </p>
        </form>

        <div className="mt-6 text-center pt-6 border-t border-neutral-800/80">
          <p className="text-neutral-500 text-xs">
            Já possui uma conta?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-white hover:text-neutral-300 font-bold underline underline-offset-4 transition-colors ml-1"
            >
              Fazer Login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
