import React from 'react';
import { Link } from 'react-router-dom';
import { BrewwLogo } from './BrewwMark';

// Cabecalho e rodape das paginas publicas (home, instalador). Usar dentro de .brew-landing.

export const SiteHeader: React.FC = () => (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-[var(--bg)]/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6" aria-label="Principal">
            <Link to="/" aria-label="Breww, início">
                <BrewwLogo />
            </Link>
            <div className="hidden items-center gap-8 text-sm text-[var(--muted)] md:flex">
                <a href="/#recursos" className="hover:text-[var(--ink)]">Recursos</a>
                <Link to="/instalar" className="hover:text-[var(--ink)]">Monte o seu</Link>
                <a href="/#precos" className="hover:text-[var(--ink)]">Preços</a>
                <Link to="/ajuda" className="hover:text-[var(--ink)]">Ajuda</Link>
            </div>
            <div className="flex items-center gap-2">
                <Link to="/login" className="rounded-full px-4 py-2 text-sm font-medium hover:bg-black/5">Entrar</Link>
                <Link to="/register" className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white hover:bg-black">Criar conta</Link>
            </div>
        </nav>
    </header>
);

export const SiteFooter: React.FC = () => (
    <footer className="bg-[var(--ink)] text-[#a3a7b0]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <BrewwLogo className="text-white" />
            <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm" aria-label="Rodapé">
                <a href="/#recursos" className="hover:text-white">Recursos</a>
                <Link to="/instalar" className="hover:text-white">Monte o seu</Link>
                <Link to="/ajuda" className="hover:text-white">Ajuda</Link>
                <a href="https://github.com/lgimenes-br/breww-firmware" target="_blank" rel="noopener noreferrer" className="hover:text-white">Firmware no GitHub</a>
                <Link to="/login" className="hover:text-white">Entrar</Link>
                <Link to="/register" className="hover:text-white">Criar conta</Link>
            </nav>
            <p className="text-sm">© {new Date().getFullYear()} Breww</p>
        </div>
    </footer>
);
