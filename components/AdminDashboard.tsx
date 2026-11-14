import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Boxes, Download, HeartPulse, LayoutGrid, Library, LogOut, Menu, Shield, Terminal, TestTube, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { OverviewTab } from './admin/OverviewTab';
import { TelemetryTab } from './admin/TelemetryTab';
import { UsersTab } from './admin/UsersTab';
import { SecurityTab } from './admin/SecurityTab';
import { FirmwareTab } from './admin/FirmwareTab';
import { FleetTab } from './admin/FleetTab';
import { IngredientsTab } from './admin/IngredientsTab';
import { TerminalTab } from './admin/TerminalTab';
import { MarketingTab } from './admin/MarketingTab';
import { LibraryTab } from './admin/LibraryTab';

// Painel de administracao na identidade do app (escuro, cartoes Grafite, um verde so).
// Navegacao lateral agrupada; cada secao tem endereco proprio (/admin/<secao>).

type Section = { id: string; label: string; group: string; icon: React.ElementType; title: string; desc: string; Comp: React.FC };

const SECTIONS: Section[] = [
    { id: 'visao-geral', label: 'Visão geral', group: '', icon: LayoutGrid, title: 'Visão geral', desc: 'Usuários, aparelhos e lotes da plataforma.', Comp: OverviewTab },
    { id: 'frota', label: 'Frota', group: 'Operação', icon: Boxes, title: 'Frota', desc: 'Aparelhos por placa, versão de firmware e hardware detectado.', Comp: FleetTab },
    { id: 'telemetria', label: 'Telemetria', group: 'Operação', icon: Activity, title: 'Telemetria', desc: 'Últimas leituras e sinal de cada aparelho.', Comp: TelemetryTab },
    { id: 'firmware', label: 'Firmware', group: 'Operação', icon: Download, title: 'Firmware', desc: 'Atualização manual (OTA) de um aparelho.', Comp: FirmwareTab },
    { id: 'contas', label: 'Contas e aparelhos', group: 'Clientes', icon: Users, title: 'Contas e aparelhos', desc: 'Usuários, planos e aparelhos vinculados.', Comp: UsersTab },
    { id: 'biblioteca', label: 'Biblioteca de perfis', group: 'Clientes', icon: Library, title: 'Biblioteca de perfis', desc: 'Perfis publicados pelos usuários, com as denúncias primeiro.', Comp: LibraryTab },
    { id: 'saude', label: 'Saúde e marketing', group: 'Clientes', icon: HeartPulse, title: 'Saúde e marketing', desc: 'Engajamento, notificações e avisos para os usuários.', Comp: MarketingTab },
    { id: 'seguranca', label: 'Segurança e avisos', group: 'Sistema', icon: Shield, title: 'Segurança e avisos', desc: 'Auditoria, avisos do sistema e controle de acesso.', Comp: SecurityTab },
    { id: 'terminal', label: 'Terminal', group: 'Sistema', icon: Terminal, title: 'Terminal do servidor', desc: 'Processos e registros do backend.', Comp: TerminalTab },
    { id: 'ingredientes', label: 'Ingredientes', group: 'Sistema', icon: TestTube, title: 'Banco de ingredientes', desc: 'Maltes, lúpulos e leveduras usados nas receitas.', Comp: IngredientsTab },
];
const GROUPS = ['', 'Operação', 'Clientes', 'Sistema'];

const NavList: React.FC<{ active: string; onNavigate?: () => void }> = ({ active, onNavigate }) => (
    <nav aria-label="Seções do painel" className="space-y-6">
        {GROUPS.map(g => (
            <div key={g || 'inicio'}>
                {g && <p className="mb-2 px-3.5 text-[13px] text-[var(--tertiary)]">{g}</p>}
                <ul className="space-y-0.5">
                    {SECTIONS.filter(s => s.group === g).map(s => {
                        const Icon = s.icon;
                        const on = s.id === active;
                        return (
                            <li key={s.id}>
                                <Link
                                    to={`/admin/${s.id}`}
                                    onClick={onNavigate}
                                    aria-current={on ? 'page' : undefined}
                                    className={`flex items-center gap-3 rounded-full px-3.5 h-10 text-[15px] transition-colors ${on ? 'bg-[var(--fill)] text-[var(--accent)]' : 'text-[var(--muted)] hover:bg-white/[0.05] hover:text-[var(--ink)]'}`}
                                >
                                    <Icon size={17} strokeWidth={1.75} aria-hidden />
                                    {s.label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
        ))}
    </nav>
);

export const AdminDashboard = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

    // /admin/<secao>; enderecos antigos (/admin) caem na visao geral
    const slug = location.pathname.replace(/^\/admin\/?/, '').split('/')[0];
    const section = SECTIONS.find(s => s.id === slug);

    useEffect(() => {
        if (section) document.title = `${section.title} — Admin Breww`;
    }, [section]);

    if (!section) return <Navigate to="/admin/visao-geral" replace />;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };
    const Comp = section.Comp;
    const name = String(user || 'Admin');

    const Account = (
        <div className="flex items-center gap-3 app-row px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fill)] text-xs font-medium">{name.charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
            <button type="button" onClick={handleLogout} aria-label="Sair" title="Sair" className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[rgba(255,90,110,0.10)] hover:text-[var(--danger)]">
                <LogOut size={17} />
            </button>
        </div>
    );

    return (
        <div className="brew-admin min-h-screen text-[var(--ink)] antialiased">
            {/* Barra lateral (desktop) */}
            <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-[var(--line)] bg-[rgba(4,7,11,0.6)] backdrop-blur-md px-4 py-5 lg:flex">
                <Link to="/admin/visao-geral" className="mb-8 flex items-center gap-2 px-3" aria-label="Painel de administração">
                    <span className="text-[20px] tracking-[-0.02em]">breww</span>
                    <span className="ml-1 rounded-full border border-[var(--line-strong)] px-2 py-0.5 text-[12px] text-[var(--muted)]">admin</span>
                </Link>
                <div className="flex-1 overflow-y-auto"><NavList active={section.id} /></div>
                {Account}
            </aside>

            {/* Topo (celular e tablet) */}
            <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--line)] bg-[rgba(4,7,11,0.85)] px-4 py-3 backdrop-blur-md lg:hidden">
                <Link to="/admin/visao-geral" className="flex items-center gap-2" aria-label="Painel de administração">
                    <span className="text-lg tracking-[-0.02em]">breww</span>
                    <span className="rounded-full border border-[var(--line-strong)] px-2 py-0.5 text-[12px] text-[var(--muted)]">admin</span>
                </Link>
                <button type="button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu" aria-expanded={menuOpen} className="app-icon-btn !w-11 !h-11">
                    <Menu size={20} />
                </button>
            </header>
            {menuOpen && (
                <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu do painel">
                    <button type="button" className="absolute inset-0 bg-black/60" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />
                    <div className="absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col border-l border-[var(--line)] bg-[#0A0E14] px-4 py-5 shadow-2xl">
                        <div className="mb-6 flex items-center justify-between px-3">
                            <span className="text-sm font-medium text-[var(--muted)]">Menu</span>
                            <button type="button" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" className="app-icon-btn !w-11 !h-11"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto"><NavList active={section.id} onNavigate={() => setMenuOpen(false)} /></div>
                        {Account}
                    </div>
                </div>
            )}

            {/* Conteudo */}
            <main className="lg:pl-64">
                <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 lg:py-10">
                    <header className="mb-8">
                        <h1 className="text-[40px] sm:text-[52px] font-light leading-[1.04] tracking-[-0.03em]">{section.title}</h1>
                        <p className="mt-2 text-[16px] text-[var(--muted)]">{section.desc}</p>
                    </header>
                    <Comp />
                </div>
            </main>
        </div>
    );
};
