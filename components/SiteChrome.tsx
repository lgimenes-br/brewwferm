import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { BrewwLogo } from './BrewwMark';

// Cabecalho e rodape das paginas publicas (home, instalador, ajuda, legais). Usar dentro de .brew-landing.
// No celular os links vao para um menu que abre abaixo do cabecalho; tudo o que se toca tem 44 px ou mais.

const NAV: { label: string; to: string; anchor?: boolean }[] = [
    { label: 'Recursos', to: '/#recursos', anchor: true },
    { label: 'Monte o seu', to: '/instalar' },
    { label: 'Preços', to: '/#precos', anchor: true },
    { label: 'Ajuda', to: '/ajuda' },
];

const NavLink: React.FC<{ item: typeof NAV[number]; className: string; onClick?: () => void }> = ({ item, className, onClick }) =>
    item.anchor
        ? <a href={item.to} className={className} onClick={onClick}>{item.label}</a>
        : <Link to={item.to} className={className} onClick={onClick}>{item.label}</Link>;

export const SiteHeader: React.FC = () => {
    const [open, setOpen] = useState(false);
    const { pathname, hash } = useLocation();

    useEffect(() => { setOpen(false); }, [pathname, hash]);
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    return (
        <header className="sticky top-0 z-30 border-b border-black/5 bg-[var(--bg)]/85 backdrop-blur-md">
            <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6" aria-label="Principal">
                <Link to="/" aria-label="Breww, início" className="-ml-1 flex min-h-11 items-center px-1">
                    <BrewwLogo />
                </Link>
                <div className="hidden items-center gap-1 text-sm text-[var(--muted)] md:flex">
                    {NAV.map(item => <NavLink key={item.label} item={item} className="flex min-h-11 items-center rounded-full px-3.5 hover:text-[var(--ink)]" />)}
                </div>
                <div className="flex items-center gap-1">
                    <Link to="/register" className="inline-flex min-h-11 items-center rounded-full bg-[var(--ink)] px-5 text-sm font-medium text-white hover:bg-black">Criar conta</Link>
                    <button
                        type="button"
                        className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--ink)] hover:bg-black/[0.04] md:hidden"
                        aria-label={open ? 'Fechar menu' : 'Abrir menu'}
                        aria-expanded={open}
                        aria-controls="menu-celular"
                        onClick={() => setOpen(o => !o)}
                    >
                        {open ? <X size={22} strokeWidth={1.75} /> : <Menu size={22} strokeWidth={1.75} />}
                    </button>
                </div>
            </nav>
            {open && (
                <div id="menu-celular" className="border-t border-black/5 bg-[var(--bg)] md:hidden">
                    <ul className="mx-auto max-w-6xl px-4 py-2">
                        {NAV.map(item => (
                            <li key={item.label}>
                                <NavLink item={item} onClick={() => setOpen(false)} className="flex min-h-12 items-center border-b border-black/5 text-lg text-[var(--ink)]" />
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </header>
    );
};

const footLink = 'inline-flex min-h-11 min-w-11 items-center hover:text-white';

export const SiteFooter: React.FC = () => (
    <footer className="on-dark border-t border-white/[0.08] bg-[var(--ink)] text-[#a3a7b0]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-[max(3.5rem,env(safe-area-inset-bottom))] pt-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <BrewwLogo className="text-white" />
            <nav className="flex flex-wrap gap-x-7 text-sm" aria-label="Rodapé">
                {NAV.map(item => <NavLink key={item.label} item={item} className={footLink} />)}
                <a href="https://github.com/lgimenes-br/breww-firmware" target="_blank" rel="noopener noreferrer" className={footLink}>Firmware no GitHub</a>
            </nav>
            <p className="flex flex-wrap gap-x-5 text-sm">
                <span className="inline-flex min-h-11 items-center">© {new Date().getFullYear()} Breww</span>
                <Link to="/privacidade" className={footLink}>Privacidade</Link>
                <Link to="/termos" className={footLink}>Termos</Link>
            </p>
        </div>
    </footer>
);
