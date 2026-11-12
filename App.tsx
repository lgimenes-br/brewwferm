import React, { useState, Suspense } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { Toaster, toast } from 'react-hot-toast';
import { Login } from './components/Login';
import { AppLogin } from './components/AppLogin';
import { Register } from './components/Register';
import { LayoutGrid, History, Settings as SettingsIcon, LogOut, Circle, Snowflake, Flame, ArrowLeft, Timer, FlaskConical, Beer, ChevronDown, Check, Calculator, Menu, X, GitCompare } from 'lucide-react';
import { DeviceMode, isDeviceOnline } from './types';
import { fetchFirmwareVersion } from './services/api';
import { isFirmwareUpdateAvailable } from './services/firmware';
import { isOtaFinal } from './services/otaSession';
import { OtaProgressModal } from './components/OtaProgressModal';
import { useAuth } from './context/AuthContext';
import { Privacy, Terms } from './components/Legal';
import { BrewwLogo } from './components/BrewwMark';
import { ProtectedRoute, PublicRoute, AdminRoute } from './components/AuthGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useFermenters } from './hooks/useFermenters';
import { useBrew } from './context/BrewContext';
import { useLocation } from 'react-router-dom';
import { SystemBanner } from './components/SystemBanner';
import { ConfirmDialog } from './components/ConfirmDialog';

const FermenterDetailWrapper = React.lazy(() => import('./components/FermenterDetailWrapper').then(m => ({ default: m.FermenterDetailWrapper })));
const FermentationHistory = React.lazy(() => import('./components/FermentationHistory').then(m => ({ default: m.FermentationHistory })));
const FinishedBrewDetailWrapper = React.lazy(() => import('./components/FinishedBrewDetailWrapper').then(m => ({ default: m.FinishedBrewDetailWrapper })));
const InstallWizard = React.lazy(() => import('./components/InstallWizard').then(m => ({ default: m.InstallWizard })));
const Settings = React.lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const BrewingCalculators = React.lazy(() => import('./components/BrewingCalculators').then(m => ({ default: m.BrewingCalculators })));
const CompareBatches = React.lazy(() => import('./components/CompareBatches').then(m => ({ default: m.CompareBatches })));
const PublicLiveBatch = React.lazy(() => import('./components/PublicLiveBatch').then(m => ({ default: m.PublicLiveBatch })));
const Help = React.lazy(() => import('./components/Help').then(m => ({ default: m.Help })));
const Installer = React.lazy(() => import('./components/Installer').then(m => ({ default: m.Installer })));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

const NavConfig = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, role } = useAuth();
    const { fermenters } = useFermenters();
    const { sendCommand, otaProgress, clearOtaProgress, otaSessions, startOta, dismissOta } = useBrew();
    // Modal de atualizacao: fechar durante a atualizacao so esconde; depois de concluida, descarta
    const [hiddenOta, setHiddenOta] = useState<Record<string, number>>({});
    const visibleOta = Object.values(otaSessions).find(s => !hiddenOta[s.serial] || hiddenOta[s.serial] < s.startedAt) || null;
    const [latestFirmware, setLatestFirmware] = useState<{version: string, md5?: string, url?: string} | null>(null);
    const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isOtaConfirmOpen, setIsOtaConfirmOpen] = useState(false);
    const [now, setNow] = useState(Date.now());

    React.useEffect(() => {
        const interval = setInterval(() => {
            if (typeof document === 'undefined' || !document.hidden) {
                setNow(Date.now());
            }
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    React.useEffect(() => {
        const path = location.pathname;
        let pageTitle = 'Breww';
        if (path === '/login') pageTitle = 'Entrar — Breww';
        else if (path === '/register') pageTitle = 'Criar Conta — Breww';
        else if (path === '/history') pageTitle = 'Logs de Produção — Breww';
        else if (path.startsWith('/history/')) pageTitle = 'Detalhes do Lote — Breww';
        else if (path === '/calculators') pageTitle = 'Calculadoras — Breww';
        else if (path === '/compare') pageTitle = 'Comparar Lotes — Breww';
        else if (path === '/settings') pageTitle = 'Configurações — Breww';
        else if (path.startsWith('/admin')) pageTitle = 'Painel Admin — Breww';
        else if (path.startsWith('/fermenter/')) pageTitle = 'Controle de Fermentação — Breww';
        else if (path.startsWith('/live/')) pageTitle = 'Acompanhamento Ao Vivo — Breww';
        else pageTitle = 'Dispositivos — Breww';
        document.title = pageTitle;
    }, [location.pathname]);

    React.useEffect(() => {
        fetchFirmwareVersion().then(data => {
            if (data) setLatestFirmware(data);
        });
    }, []);

    // If admin, we don't render this NavConfig. They get a full-screen admin experience.
    if (role === 'admin') return null;

    // Hide navigation bar on public or landing pages
    const publicRoutes = ['/login', '/register', '/app-login', '/instalar', '/instalar/assistente', '/ajuda', '/privacidade', '/termos'];
    if (publicRoutes.includes(location.pathname) || location.pathname.startsWith('/live/')) return null;

    // Check if we are inside a device page
    const match = location.pathname.match(/\/fermenter\/(.+)/);
    let deviceId: string | null = null;
    if (match) {
        try {
            deviceId = decodeURIComponent(match[1]);
        } catch (e) {
            deviceId = match[1];
        }
    }
    const activeDevice = deviceId ? fermenters.find(f => (f.id || '').toUpperCase() === deviceId!.toUpperCase()) : null;

    const handleModeDropdownSelect = (mode: DeviceMode) => {
        setIsModeDropdownOpen(false);
        window.dispatchEvent(new CustomEvent('requestModeChange', { detail: { mode } }));
    };

    const isOnline = isDeviceOnline(activeDevice, now);
    const statOp = isOnline
        ? String(activeDevice?.currentDevice?.statOp || 'INATIVO').toUpperCase()
        : (activeDevice?.currentDevice ? 'OFFLINE' : 'INATIVO');

    // Icon Styles
    const iconOnlyBase = "flex items-center justify-center w-9 h-9 rounded-md border transition-all shrink-0 border-black/[0.07] text-[var(--muted)] hover:border-black/25 hover:text-[var(--ink)]";

    // Check if any device needs an update
    const devicesNeedingUpdate = fermenters.filter(f => latestFirmware && isFirmwareUpdateAvailable(latestFirmware.version, f.currentDevice?.version));
    const hasUpdate = devicesNeedingUpdate.length > 0;

    const handleUpdateAll = () => {
        if (!latestFirmware) return;
        if (devicesNeedingUpdate.length === 0) return;
        setIsOtaConfirmOpen(true);
    };

    const confirmUpdateAll = () => {
        setIsOtaConfirmOpen(false);
        if (!latestFirmware || devicesNeedingUpdate.length === 0) return;
        const finalUrl = latestFirmware.url || `${window.location.origin}/firmware/update.bin`;
        devicesNeedingUpdate.forEach(device => {
            startOta(device.id, { name: device.name, targetVersion: latestFirmware.version });
            sendCommand(device.id, 'update_firmware', { url: finalUrl, md5: latestFirmware.md5 || '' });
        });
    };

    return (
        <div className="no-print mb-6">
        <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:px-4 focus:py-2 focus:bg-amber-400 focus:text-black focus:font-bold focus:rounded-lg"
        >
            Pular para o conteúdo principal
        </a>
        <nav className="bg-[var(--bg)] py-4 md:py-6 border-b border-black/[0.07]">
            <div className="w-full mx-auto px-6 md:px-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Top Row for Mobile (Logo + Hamburger) */}
                <div className="flex items-center justify-between w-full md:w-auto">
                    {/* Left Side: Logo Only */}
                    <div
                        role="button"
                        tabIndex={0}
                        aria-label="Ir para a página inicial"
                        className="flex items-center cursor-pointer select-none rounded-lg"
                        onClick={() => navigate('/')}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                navigate('/');
                            }
                        }}
                    >
                        <BrewwLogo className="text-[var(--ink)]" />
                    </div>

                    {/* Mobile Hamburger Button */}
                    <button 
                        aria-label={isMobileMenuOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
                        aria-expanded={isMobileMenuOpen}
                        className="md:hidden flex items-center justify-center w-10 h-10 text-[var(--muted)] hover:text-[var(--ink)] transition-colors border border-black/[0.07] rounded-md"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                {/* Right Side: Badges + Nav */}
                <div className="flex items-center gap-2">
                    {/* Contextual Badges for Device Pages */}
                    {activeDevice && (
                        <div className="hidden md:flex items-center gap-2 mr-3 animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* Online/Offline Badge */}
                            <div className={`flex items-center gap-2 px-3 h-9 rounded-md border font-mono text-[11px] font-semibold transition-all ${
                                isOnline 
                                    ? 'border-[#2fbf55] text-[#178a3f]' 
                                    : 'border-red-500 text-[#d63a4d]'
                            }`}>
                                <div className={`w-2 h-2 rounded-full bg-current ${isOnline ? 'animate-pulse' : ''}`}></div>
                                {activeDevice.name}
                            </div>

                            {/* StatOp Badge */}
                            {statOp === 'AQUECENDO' && (
                                <div className="flex items-center gap-2 px-3 h-9 rounded-md border border-red-500 text-[#d63a4d] font-mono text-[11px] font-semibold ">
                                    <Flame size={14} /> AQUECENDO
                                </div>
                            )}
                            {statOp === 'RESFRIANDO' && (
                                <div className="flex items-center gap-2 px-3 h-9 rounded-md border border-blue-500 text-blue-600 font-mono text-[11px] font-semibold ">
                                    <Snowflake size={14} /> RESFRIANDO
                                </div>
                            )}
                            {statOp.startsWith('DELAY') && (
                                <div className="flex items-center gap-2 px-3 h-9 rounded-md border border-[#ca8a04] text-[#a16207] font-mono text-[11px] font-semibold ">
                                    <Timer size={14} /> {statOp}
                                </div>
                            )}
                            {statOp === 'AGUARDANDO' && (
                                <div className="flex items-center gap-2 px-3 h-9 rounded-md border border-[#ca8a04] text-[#a16207] font-mono text-[11px] font-semibold ">
                                    <Circle size={14} /> AGUARDANDO
                                </div>
                            )}
                            {(statOp !== 'AQUECENDO' && statOp !== 'RESFRIANDO' && statOp !== 'AGUARDANDO' && !statOp.startsWith('DELAY')) && (
                                <div className="flex items-center gap-2 px-3 h-9 rounded-md border border-zinc-500 text-[var(--muted)] font-mono text-[11px] font-semibold ">
                                    <Circle size={14} /> {statOp === 'INATIVO' ? 'PARADO' : statOp}
                                </div>
                            )}

                            {/* MODE DROPDOWN Badge in Navbar */}
                            <div className="relative ml-1">
                                <button 
                                    onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                                    className="flex items-center gap-2 px-3 h-9 rounded-md border border-black/[0.07] hover:border-black/25 bg-[var(--bg)] text-[#2b2f37] hover:text-[var(--ink)] transition-all"
                                >
                                    {activeDevice.mode === DeviceMode.FERMENTER && <FlaskConical size={14} />}
                                    {activeDevice.mode === DeviceMode.KEGERATOR && <Beer size={14} />}
                                    {activeDevice.mode === DeviceMode.FRIDGE && <Snowflake size={14} />}
                                    
                                    <span className="text-[11px] font-bold hidden lg:block">
                                        {activeDevice.mode === DeviceMode.FERMENTER ? 'Fermentador' : activeDevice.mode === DeviceMode.KEGERATOR ? 'Chopeira' : 'Geladeira'}
                                    </span>
                                    <ChevronDown size={14} className={`text-[var(--muted)] transition-transform ${isModeDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isModeDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsModeDropdownOpen(false)}></div>
                                        <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-black/[0.07] rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <button
                                                onClick={() => handleModeDropdownSelect(DeviceMode.FERMENTER)}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg)] transition-colors text-left"
                                            >
                                                <FlaskConical size={14} className={`transition-colors ${activeDevice.mode === DeviceMode.FERMENTER ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`} />
                                                <span className={`text-xs font-bold flex-1 transition-colors ${activeDevice.mode === DeviceMode.FERMENTER ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>Fermentador</span>
                                                {activeDevice.mode === DeviceMode.FERMENTER && <Check size={14} className="text-[#178a3f]" />}
                                            </button>
                                            <button
                                                onClick={() => handleModeDropdownSelect(DeviceMode.KEGERATOR)}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg)] transition-colors text-left"
                                            >
                                                <Beer size={14} className={`transition-colors ${activeDevice.mode === DeviceMode.KEGERATOR ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`} />
                                                <span className={`text-xs font-bold flex-1 transition-colors ${activeDevice.mode === DeviceMode.KEGERATOR ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>Chopeira</span>
                                                {activeDevice.mode === DeviceMode.KEGERATOR && <Check size={14} className="text-[#178a3f]" />}
                                            </button>
                                            <button
                                                onClick={() => handleModeDropdownSelect(DeviceMode.FRIDGE)}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg)] transition-colors text-left"
                                            >
                                                <Snowflake size={14} className={`transition-colors ${activeDevice.mode === DeviceMode.FRIDGE ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`} />
                                                <span className={`text-xs font-bold flex-1 transition-colors ${activeDevice.mode === DeviceMode.FRIDGE ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>Geladeira</span>
                                                {activeDevice.mode === DeviceMode.FRIDGE && <Check size={14} className="text-[#178a3f]" />}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Navigation Icons (Desktop only) */}
                    <div className="hidden md:flex items-center gap-2">
                        <button title="Visão Geral" aria-label="Visão Geral" aria-current={location.pathname === '/' ? 'page' : undefined} onClick={() => navigate('/')} className={iconOnlyBase} >
                            <LayoutGrid size={18} />
                        </button>
                        <button title="Logs" aria-label="Logs" aria-current={location.pathname.startsWith('/history') ? 'page' : undefined} onClick={() => navigate('/history')} className={iconOnlyBase} >
                            <History size={18} />
                        </button>
                        <button title="Calculadoras" aria-label="Calculadoras" aria-current={location.pathname === '/calculators' ? 'page' : undefined} onClick={() => navigate('/calculators')} className={iconOnlyBase} >
                            <Calculator size={18} />
                        </button>
                        <button title="Comparador" aria-label="Comparador" aria-current={location.pathname === '/compare' ? 'page' : undefined} onClick={() => navigate('/compare')} className={iconOnlyBase} >
                            <GitCompare size={18} />
                        </button>
                        <button title="Settings" aria-label="Configurações" aria-current={location.pathname === '/settings' ? 'page' : undefined} onClick={() => navigate('/settings')} className={iconOnlyBase}>
                            <SettingsIcon size={18} />
                        </button>

                        {/* Voltar Button - moved to the right corner */}
                        {(activeDevice || location.pathname.startsWith('/history') || location.pathname === '/settings' || location.pathname === '/calculators' || location.pathname === '/compare' || location.pathname.startsWith('/admin')) && (
                            <button title="Voltar" aria-label="Voltar" onClick={() => navigate(-1)} className={iconOnlyBase}>
                                <ArrowLeft size={18} />
                            </button>
                        )}

                        {location.pathname === '/' && (
                            <button onClick={() => logout()} aria-label="Sair" className="ml-2 p-2 text-black/35 hover:text-[#d63a4d] transition-colors" title="Sair">
                                <LogOut size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div role="dialog" aria-modal="true" aria-label="Menu de navegação" className="fixed inset-0 z-50 bg-[var(--bg)] flex flex-col md:hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between p-6 border-b border-black/[0.07] bg-[var(--bg)]">
                        <BrewwLogo className="text-[var(--ink)]" />
                        <button 
                            aria-label="Fechar menu de navegação"
                            className="flex items-center justify-center w-10 h-10 text-[var(--muted)] hover:text-[var(--ink)] transition-colors border border-black/[0.07] rounded-md"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto overscroll-contain p-6 flex flex-col gap-4">
                        <button onClick={() => { setIsMobileMenuOpen(false); navigate('/'); }} className="flex items-center gap-4 p-4 text-[var(--ink)] bg-white hover:bg-[var(--bg)] rounded-xl transition-colors text-left border border-black/[0.07]">
                            <div className="flex items-center justify-center w-12 h-12 bg-[var(--bg)] rounded-lg text-[var(--ink)]"><LayoutGrid size={24} /></div>
                            <span className="text-lg font-bold tracking-tight">Visão Geral</span>
                        </button>
                        <button onClick={() => { setIsMobileMenuOpen(false); navigate('/history'); }} className="flex items-center gap-4 p-4 text-[var(--ink)] bg-white hover:bg-[var(--bg)] rounded-xl transition-colors text-left border border-black/[0.07]">
                            <div className="flex items-center justify-center w-12 h-12 bg-[var(--bg)] rounded-lg text-[var(--ink)]"><History size={24} /></div>
                            <span className="text-lg font-bold tracking-tight">Histórico / Logs</span>
                        </button>
                        <button onClick={() => { setIsMobileMenuOpen(false); navigate('/calculators'); }} className="flex items-center gap-4 p-4 text-[var(--ink)] bg-white hover:bg-[var(--bg)] rounded-xl transition-colors text-left border border-black/[0.07]">
                            <div className="flex items-center justify-center w-12 h-12 bg-[var(--bg)] rounded-lg text-[var(--ink)]"><Calculator size={24} /></div>
                            <span className="text-lg font-bold tracking-tight">Calculadoras</span>
                        </button>
                        <button onClick={() => { setIsMobileMenuOpen(false); navigate('/compare'); }} className="flex items-center gap-4 p-4 text-[var(--ink)] bg-white hover:bg-[var(--bg)] rounded-xl transition-colors text-left border border-black/[0.07]">
                            <div className="flex items-center justify-center w-12 h-12 bg-[var(--bg)] rounded-lg text-[var(--ink)]"><GitCompare size={24} /></div>
                            <span className="text-lg font-bold tracking-tight">Comparar Lotes</span>
                        </button>
                        <button onClick={() => { setIsMobileMenuOpen(false); navigate('/settings'); }} className="flex items-center gap-4 p-4 text-[var(--ink)] bg-white hover:bg-[var(--bg)] rounded-xl transition-colors text-left border border-black/[0.07]">
                            <div className="flex items-center justify-center w-12 h-12 bg-[var(--bg)] rounded-lg text-[var(--ink)]"><SettingsIcon size={24} /></div>
                            <span className="text-lg font-bold tracking-tight">Configurações</span>
                        </button>
                        
                        {(activeDevice || location.pathname.startsWith('/history') || location.pathname === '/settings' || location.pathname === '/calculators' || location.pathname === '/compare' || location.pathname.startsWith('/admin')) && (
                            <button onClick={() => { setIsMobileMenuOpen(false); navigate(-1); }} className="flex items-center gap-4 p-4 text-[var(--ink)] bg-white hover:bg-[var(--bg)] rounded-xl transition-colors text-left border border-black/[0.07] mt-auto">
                                <div className="flex items-center justify-center w-12 h-12 bg-[var(--bg)] rounded-lg text-[var(--ink)]"><ArrowLeft size={24} /></div>
                                <span className="text-lg font-bold tracking-tight">Voltar</span>
                            </button>
                        )}
                        
                        {location.pathname === '/' && (
                            <button onClick={() => { setIsMobileMenuOpen(false); logout(); }} className="flex items-center gap-4 p-4 text-[#d63a4d] bg-red-500/5 hover:bg-red-500/10 rounded-xl transition-colors text-left border border-red-500/20 mt-auto">
                                <div className="flex items-center justify-center w-12 h-12 bg-red-500/10 rounded-lg text-[#d63a4d]"><LogOut size={24} /></div>
                                <span className="text-lg font-bold tracking-tight">Sair do Sistema</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </nav>
        
        {/* Global Firmware Alert */}
        {hasUpdate && (() => {
            const getDevProgress = (id: string) => otaProgress?.[(id || '').toUpperCase()] ?? otaProgress?.[id] ?? 0;
            const maxProgress = devicesNeedingUpdate.reduce((acc, dev) => Math.max(acc, getDevProgress(dev.id)), 0);
            const isUpdating = maxProgress > 0;
            // Aviso escondido em Configuracoes (la existe o box proprio); o modal de progresso aparece em qualquer pagina
            const showBanner = location.pathname !== '/settings';
            return (
                <>
                {showBanner && <div className="w-full bg-amber-100 border-b border-amber-300 py-3 px-6 md:px-10 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-500 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                        <p className="text-[#b45309] text-xs md:text-sm font-medium">
                            Nova atualização de firmware ({latestFirmware!.version}) disponível para {devicesNeedingUpdate.length} equipamento{devicesNeedingUpdate.length > 1 ? 's' : ''}.
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handleUpdateAll}
                            disabled={isUpdating}
                            className="px-4 py-1.5 bg-amber-600/20 hover:bg-amber-600 disabled:opacity-50 border border-amber-600/50 text-[#b45309] hover:text-[var(--ink)] rounded-lg text-[10px] md:text-xs font-bold transition-colors shrink-0"
                        >
                            {isUpdating ? 'Instalando...' : 'Atualizar Agora'}
                        </button>
                    </div>
                </div>}

                </>
            );
        })()}
        <OtaProgressModal
            session={visibleOta}
            deviceName={visibleOta ? fermenters.find(f => (f.id || '').toUpperCase() === visibleOta.serial)?.name : undefined}
            onClose={() => {
                if (!visibleOta) return;
                if (isOtaFinal(visibleOta)) dismissOta(visibleOta.serial);
                else setHiddenOta(prev => ({ ...prev, [visibleOta.serial]: Date.now() }));
            }}
        />
        <ConfirmDialog
            open={isOtaConfirmOpen}
            title="Atualizar Firmware"
            description={`Deseja iniciar a atualização para a versão ${latestFirmware?.version || ''} em ${devicesNeedingUpdate.length} equipamento(s)? Eles serão reiniciados automaticamente.`}
            confirmLabel="Atualizar Agora"
            variant="warning"
            onConfirm={confirmUpdateAll}
            onCancel={() => setIsOtaConfirmOpen(false)}
        />
        </div>
    );
};

const AppRoutes = () => {
    const { role } = useAuth();
    return (
        <div className="brew-landing brew-app min-h-screen min-h-[100dvh] bg-[var(--bg)] text-[var(--ink)] [font-family:var(--font-body)] antialiased">
            <Toaster 
                position="top-right"
                toastOptions={{
                    style: {
                        background: '#0B0D12',
                        color: '#fff',
                        borderRadius: '14px',
                        fontSize: '14px'
                    }
                }}
            />
            <SystemBanner />
            <Suspense fallback={<div className="min-h-screen min-h-[100dvh] bg-[var(--bg)]" />}>
                <Routes>
                    {/* Public Auth Routes */}
                    <Route path="/login" element={
                        <PublicRoute>
                            <Login />
                            {/* We will let AuthContext handle the actual login state in Login component directly now */}
                        </PublicRoute>
                    } />
                    <Route path="/register" element={
                        <PublicRoute>
                            <Register />
                        </PublicRoute>
                    } />
                    <Route path="/live/:token" element={<PublicLiveBatch />} />
                    {/* Login do app nativo (aberto pelo app numa janela segura do sistema) */}
                    <Route path="/app-login" element={<AppLogin />} />
                    {/* Instalador do firmware pelo navegador (publico) */}
                    <Route path="/instalar" element={<Installer />} />
                    <Route path="/instalar/assistente" element={<InstallWizard />} />
                    <Route path="/ajuda" element={<Help />} />
                    <Route path="/privacidade" element={<Privacy />} />
                    <Route path="/termos" element={<Terms />} />

                    {/* Protected App Routes */}
                    <Route path="/*" element={
                        <ProtectedRoute>
                            <NavConfig />
                            <main id="main-content" className="mt-0">
                                <ErrorBoundary name="Rotas Principais">
                                    <Suspense fallback={<div className="min-h-[50vh] bg-[var(--bg)]" />}>
                                        <Routes>
                                            <Route path="/" element={role === 'admin' ? <Navigate to="/admin" replace /> : <Dashboard />} />
                                            <Route path="/fermenter/:id" element={<FermenterDetailWrapper />} />
                                            <Route path="/history" element={<FermentationHistory />} />
                                            <Route path="/history/:id" element={<FinishedBrewDetailWrapper />} />
                                            <Route path="/calculators" element={<BrewingCalculators />} />
                                            <Route path="/compare" element={<CompareBatches />} />
                                            <Route path="/settings" element={<Settings />} />
                                            <Route path="/admin/*" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                                            <Route path="*" element={<Navigate to="/" replace />} />
                                        </Routes>
                                    </Suspense>
                                </ErrorBoundary>
                            </main>
                        </ProtectedRoute>
                    } />
                </Routes>
            </Suspense>
        </div>
    );
};

export default AppRoutes;
