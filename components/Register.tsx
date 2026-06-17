
import React, { useState } from 'react';
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
    if (password !== confirmPassword) {
      alert('As senhas não conferem');
      return;
    }
    setLoading(true);
    const success = await register(name, email, password);
    setLoading(false);
    if(success) navigate('/login');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience - Monochrome/Subtle */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neutral-800/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neutral-800/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-white text-black border border-white rounded-2xl flex items-center justify-center shadow-lg mb-4 font-black text-3xl">
            B
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Criar Nova Conta</h1>
          <p className="text-neutral-400 text-sm mt-2 text-center">Junte-se à revolução da fermentação inteligente no <span className="text-white font-bold">BREWW</span></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Nome Completo</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-white transition-colors">
                <User size={16} />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-black/50 border border-neutral-800 text-neutral-100 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500 transition-all placeholder-neutral-700 text-sm"
                placeholder="Seu nome"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Email</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-white transition-colors">
                <Mail size={16} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-black/50 border border-neutral-800 text-neutral-100 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500 transition-all placeholder-neutral-700 text-sm"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Senha</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-white transition-colors">
                  <Lock size={16} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-black/50 border border-neutral-800 text-neutral-100 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500 transition-all placeholder-neutral-700 text-sm"
                  placeholder="••••••"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Confirmar</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-white transition-colors">
                  <CheckCircle size={16} />
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full bg-black/50 border border-neutral-800 text-neutral-100 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500 transition-all placeholder-neutral-700 text-sm"
                  placeholder="••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-neutral-100 hover:bg-white text-black font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed mt-6"
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
        </form>

        <div className="mt-6 text-center pt-6 border-t border-neutral-800">
          <p className="text-neutral-500 text-sm mb-2">Já possui uma conta?</p>
          <button
            onClick={() => navigate('/login')}
            className="text-neutral-300 hover:text-white font-medium text-sm underline underline-offset-4 transition-colors"
          >
            Entrar com suas credenciais
          </button>
        </div>
      </div>
    </div>
  );
};
