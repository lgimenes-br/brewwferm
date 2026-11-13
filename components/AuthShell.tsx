import React from 'react';
import { Link } from 'react-router-dom';
import { BrewwLogo, BrewwMark } from './BrewwMark';

// Moldura das telas de entrada (login, cadastro), na identidade da home:
// no computador, um painel escuro da marca a esquerda e o formulario a direita; no celular, so o formulario.
export const AuthShell: React.FC<{ title: string; subtitle?: React.ReactNode; children: React.ReactNode }> = ({ title, subtitle, children }) => (
    <div className="min-h-screen min-h-[100dvh] bg-[var(--bg)] p-3 sm:p-4 lg:grid lg:grid-cols-[1fr_1.05fr] lg:gap-4">
        <aside className="relative hidden overflow-hidden rounded-[28px] bg-[var(--card)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <Link to="/" aria-label="Breww, início"><BrewwLogo className="text-white" /></Link>
            <div className="relative z-10">
                <p className="[font-family:var(--font-display)] text-[52px] font-light leading-[1.02] tracking-[-0.035em]">
                    Sua fermentação, <span className="text-[var(--accent)]">no ponto.</span>
                </p>
                <p className="mt-5 max-w-sm text-lg leading-relaxed text-[#a3a7b0]">
                    Temperatura, perfis e alertas do seu controlador, ao vivo no celular e no computador.
                </p>
            </div>
            <BrewwMark className="pointer-events-none absolute -bottom-16 -right-10 h-[420px] w-auto text-white/[0.04]" />
        </aside>

        <main className="flex min-h-[calc(100dvh-1.5rem)] items-center justify-center rounded-[28px] bg-white px-5 py-10 sm:px-10 lg:min-h-0">
            <div className="w-full max-w-[420px]">
                <Link to="/" aria-label="Breww, início" className="mb-10 inline-block lg:hidden"><BrewwLogo className="text-[var(--ink)]" /></Link>
                <h1 className="[font-family:var(--font-display)] text-[40px] font-light leading-[1.05] tracking-[-0.035em]">{title}</h1>
                {subtitle && <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">{subtitle}</p>}
                <div className="mt-8">{children}</div>
            </div>
        </main>
    </div>
);
