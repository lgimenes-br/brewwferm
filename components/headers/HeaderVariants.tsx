import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { BrewwLogo } from '../BrewwMark';

// Cabecalho das paginas publicas (escolhido em 2026-11-14 entre tres propostas): uma capsula flutuante,
// solta do topo, so com "breww", "Criar conta" e "Menu". O menu abre na tela inteira, com os links em
// letras grandes, e a capsula continua por cima para fechar.

export type HeaderItem = { label: string; to: string; anchor?: boolean };

const ItemLink: React.FC<{ item: HeaderItem; className: string; onClick?: () => void }> = ({ item, className, onClick }) =>
    item.anchor
        ? <a href={item.to} className={className} onClick={onClick}>{item.label}</a>
        : <Link to={item.to} className={className} onClick={onClick}>{item.label}</Link>;

export const HeaderFloatingMenu: React.FC<{ nav: HeaderItem[] }> = ({ nav }) => {
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const on = () => setScrolled(window.scrollY > 24);
        on();
        window.addEventListener('scroll', on, { passive: true });
        return () => window.removeEventListener('scroll', on);
    }, []);

    // Menu aberto: Esc fecha e a pagina por baixo nao rola
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        // Trava no <html> (o rolador da pagina): travar o <body> faria o cabecalho "grudado" perder a referencia
        const root = document.documentElement;
        const prev = root.style.overflow;
        root.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); root.style.overflow = prev; };
    }, [open]);

    const close = () => setOpen(false);

    return (
        <header className="sticky top-0 z-50 pt-3 sm:pt-4">
            {/* Mesma largura e margens do conteudo do site (max-w-7xl, 16/24/40 px) */}
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
            <nav aria-label="Principal"
                className={`relative z-50 flex items-center gap-2 rounded-full py-2 pl-5 pr-2 backdrop-blur-xl transition-[background-color,box-shadow] duration-300 ${scrolled || open ? 'bg-[rgba(4,7,11,0.72)] shadow-[0_20px_50px_-25px_rgba(0,0,0,0.9)]' : 'bg-[rgba(4,7,11,0.35)]'}`}>
                <Link to="/" aria-label="Breww, início" onClick={close} className="mr-auto flex min-h-10 items-center rounded-full"><BrewwLogo /></Link>
                {!open && (
                    <Link to="/register" className="hidden h-10 items-center rounded-full bg-[var(--accent)] px-5 text-[14px] font-medium text-[var(--on-accent)] hover:brightness-95 sm:inline-flex">Criar conta</Link>
                )}
                <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="menu-tela"
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[var(--fill)] px-4 text-[14px] text-[var(--ink)] hover:bg-white/10">
                    {open ? <X size={17} aria-hidden /> : <Menu size={17} aria-hidden />} {open ? 'Fechar' : 'Menu'}
                </button>
            </nav>
            </div>

            {open && (
                <div id="menu-tela" role="dialog" aria-modal="true" aria-label="Menu"
                    className="fixed inset-0 z-40 overflow-y-auto [background:radial-gradient(70%_60%_at_100%_0%,rgba(113,252,143,0.10),transparent_70%),#04070B]">
                    <div className="mx-auto grid min-h-full max-w-7xl gap-12 px-4 pb-12 pt-28 sm:px-6 lg:px-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
                        <ul className="flex flex-col">
                            {[...nav, { label: 'Entrar', to: '/login' }].map(i => (
                                <li key={i.label} className="border-b border-[var(--line)]">
                                    <ItemLink item={i} onClick={close}
                                        className="flex items-center py-4 text-[40px] font-light leading-tight tracking-[-0.03em] text-[var(--ink)] transition-colors hover:text-[var(--accent)] sm:text-[56px]" />
                                </li>
                            ))}
                        </ul>
                        <div className="app-card p-6">
                            <p className="text-[17px] text-[var(--ink)]">Grátis até 3 fermentadores.</p>
                            <p className="mt-1 text-[15px] text-[var(--muted)]">Monte o seu com um ESP32 e o firmware aberto, direto pelo navegador.</p>
                            <div className="mt-5 flex flex-wrap gap-2">
                                <Link to="/register" onClick={close} className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-[15px] font-medium text-[var(--on-accent)]">Criar conta <ArrowRight size={16} aria-hidden /></Link>
                                <Link to="/instalar" onClick={close} className="inline-flex h-11 items-center rounded-full border border-[var(--line-strong)] px-5 text-[15px] text-[var(--ink)] hover:bg-[var(--fill)]">Guia de montagem</Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};
