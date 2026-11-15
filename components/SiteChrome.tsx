import React from 'react';
import { Link } from 'react-router-dom';
import { BrewwLogo } from './BrewwMark';
import { HeaderFloatingMenu } from './headers/HeaderVariants';

// Cabecalho e rodape das paginas publicas (home, instalador, ajuda, legais). Usar dentro de .brew-landing.
// No celular os links vao para um menu que abre abaixo do cabecalho; tudo o que se toca tem 44 px ou mais.

type NavItem = { label: string; to: string; anchor?: boolean };
const NAV: NavItem[] = [
    { label: 'Recursos', to: '/#recursos', anchor: true },
    { label: 'Monte o seu', to: '/instalar' },
    { label: 'Preços', to: '/#precos', anchor: true },
    { label: 'Ajuda', to: '/ajuda' },
];

const NavLink: React.FC<{ item: NavItem; className: string; onClick?: () => void }> = ({ item, className, onClick }) =>
    item.anchor
        ? <a href={item.to} className={className} onClick={onClick}>{item.label}</a>
        : <Link to={item.to} className={className} onClick={onClick}>{item.label}</Link>;

/** minimal: modo tarefa (assistente). So o logo e uma saida; com locked (gravando) nem isso, para nao abandonar a gravacao.
 *  nav: links proprios da pagina (ex.: secoes da home nova). "Entrar" fica no menu. */
export const SiteHeader: React.FC<{ minimal?: { label: string; to: string; locked?: boolean }; nav?: NavItem[] }> = ({ minimal, nav: navItems = NAV }) => {
    if (minimal) {
        return (
            <header className="sticky top-0 z-30 border-b border-black/5 bg-[var(--bg)]">
                <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6" aria-label="Assistente">
                    {minimal.locked
                        ? <span className="-ml-1 flex min-h-11 items-center px-1" aria-label="Breww"><BrewwLogo /></span>
                        : <Link to="/" aria-label="Breww, início" className="-ml-1 flex min-h-11 items-center px-1"><BrewwLogo /></Link>}
                    {minimal.locked
                        ? <span className="text-sm text-[var(--muted)]">Gravando: não feche esta página</span>
                        : <Link to={minimal.to} className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-[var(--muted)] hover:bg-black/[0.04] hover:text-[var(--ink)]">{minimal.label}</Link>}
                </nav>
            </header>
        );
    }

    // Paginas publicas: capsula flutuante com menu em tela cheia (components/headers/HeaderVariants.tsx)
    return <HeaderFloatingMenu nav={navItems} />;
};

const footLink = 'inline-flex min-h-11 min-w-11 items-center hover:text-white';

export const SiteFooter: React.FC = () => (
    <footer className="on-dark border-t border-[var(--line)] bg-[#020305] text-[var(--muted)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-[max(3.5rem,env(safe-area-inset-bottom))] pt-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <BrewwLogo className="text-white" mark />
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
