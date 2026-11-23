import React, { useState, Suspense } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { Toaster, toast } from 'react-hot-toast';
import { Login } from './components/Login';
import { AppLogin } from './components/AppLogin';
import { Register } from './components/Register';
import { LayoutGrid, History, Settings as SettingsIcon, SlidersHorizontal, LogOut, Snowflake, ArrowLeft, FlaskConical, Beer, ChevronDown, Check, Calculator, Menu, X, GitCompare } from 'lucide-react';
import { DeviceMode, isDeviceOnline } from './types';
import { fetchFirmwareVersion } from './services/api';
import { isFirmwareUpdateAvailable } from './services/firmware';
import { isOtaFinal } from './services/otaSession';
import { OtaProgressModal } from './components/OtaProgressModal';
import { useAuth } from './context/AuthContext';
import { useMe } from './hooks/useMe';
import { UserAvatar } from './components/app/AppUI';
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
const LandingApp = React.lazy(() => import('./components/landing2/LandingApp').then(m => ({ default: m.LandingApp })));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

const NavConfig = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, role, token, user } = useAuth();
    const me = useMe(token);
    const displayName = me?.name || user || '';
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
        else if (path === '/settings') pageTitle = 'Ajustes — Breww';
        else if (path === '/preferences') pageTitle = 'Preferências — Breww';
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
    const publicRoutes = ['/home', '/home-nova', '/login', '/register', '/app-login', '/instalar', '/instalar/assistente', '/ajuda', '/privacidade', '/termos'];
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
    // Ajustes do aparelho (/settings?device=ID) tambem e "dentro do aparelho": topo com o aparelho e voltar
    const onDeviceSettings = location.pathname === '/settings';
    if (onDeviceSettings) deviceId = new URLSearchParams(location.search).get('device');
    const activeDevice = deviceId ? fermenters.find(f => (f.id || '').toUpperCase() === deviceId!.toUpperCase()) : null;

    const handleModeDropdownSelect = (mode: DeviceMode) => {
        setIsModeDropdownOpen(false);
        window.dispatchEvent(new CustomEvent('requestModeChange', { detail: { mode } }));
    };

    const isOnline = isDeviceOnline(activeDevice, now);
    const statOp = isOnline
        ? String(activeDevice?.currentDevice?.statOp || 'INATIVO').toUpperCase()
        : (activeDevice?.currentDevice ? 'OFFLINE' : 'INATIVO');

    // Aviso de firmware individual: so na tela do aparelho e so se ESTE aparelho precisa (na lista, cada
    // cartao mostra o seu). Nunca avisa num aparelho que outro precisa atualizar.
    const devicesNeedingUpdate = activeDevice && latestFirmware && isFirmwareUpdateAvailable(latestFirmware.version, activeDevice.currentDevice?.version)
        ? [activeDevice]
        : [];
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

    const tabs = [
        { to: '/', label: 'Aparelhos', icon: LayoutGrid, active: location.pathname === '/' || (!!activeDevice && !onDeviceSettings) },
        { to: '/history', label: 'Histórico', icon: History, active: location.pathname.startsWith('/history') },
        { to: '/calculators', label: 'Calculadoras', icon: Calculator, active: location.pathname === '/calculators' },
        { to: '/compare', label: 'Comparar', icon: GitCompare, active: location.pathname === '/compare' },
        // Ajustes so dentro de um aparelho (sao os ajustes dele); Preferencias (da conta) sempre
        ...(activeDevice ? [{ to: `/settings?device=${encodeURIComponent(activeDevice.id)}`, label: 'Ajustes', icon: SettingsIcon, active: onDeviceSettings }] : []),
        { to: '/preferences', label: 'Preferências', icon: SlidersHorizontal, active: location.pathname === '/preferences' },
    ];
    const showBack = !!activeDevice || /^\/history\/.+/.test(location.pathname);
    // Estado do aparelho aberto em linguagem de gente (o app usa as mesmas palavras)
    const stateLabel = !isOnline ? 'Offline'
        : statOp === 'AQUECENDO' ? 'Aquecendo'
        : statOp === 'RESFRIANDO' ? 'Resfriando'
        : statOp === 'AGUARDANDO' ? 'Aguardando'
        : statOp.startsWith('DELAY') ? 'Aguardando o compressor'
        : 'Parado';
    const modeLabel = (m?: DeviceMode) => m === DeviceMode.KEGERATOR ? 'Choppeira' : m === DeviceMode.FRIDGE ? 'Geladeira' : 'Fermentador';
    const ModeIcon = (m?: DeviceMode) => m === DeviceMode.KEGERATOR ? Beer : m === DeviceMode.FRIDGE ? Snowflake : FlaskConical;

    return (
        <div className="no-print">
        <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-[var(--on-accent)] focus:font-medium focus:rounded-full"
        >
            Pular para o conteúdo principal
        </a>
        <nav aria-label="Principal" className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(4,7,11,0.78)] backdrop-blur-md">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 h-16 flex items-center gap-3">
                {showBack && (
                    <button type="button" aria-label="Voltar" title="Voltar" onClick={() => navigate(-1)} className="app-icon-btn shrink-0">
                        <ArrowLeft size={18} />
                    </button>
                )}
                <button type="button" aria-label="Ir para os aparelhos" onClick={() => navigate('/')} className="flex items-center rounded-full shrink-0">
                    <BrewwLogo className="text-[var(--ink)]" />
                </button>

                {/* Aparelho aberto: nome, estado e modo */}
                {activeDevice && (
                    <div className="hidden lg:flex items-center gap-2 ml-3 min-w-0">
                        <span className="app-pill max-w-[280px]" title={`${activeDevice.name}: ${stateLabel}`}>
                            <span aria-hidden className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-[var(--accent)]' : 'bg-[var(--tertiary)]'}`} />
                            <span className="truncate">{activeDevice.name}</span>
                            <span className="text-[var(--muted)] shrink-0">· {stateLabel}</span>
                        </span>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                                aria-haspopup="menu"
                                aria-expanded={isModeDropdownOpen}
                                className="app-pill hover:bg-[rgba(255,255,255,0.11)] transition-colors"
                            >
                                {React.createElement(ModeIcon(activeDevice.mode), { size: 15, 'aria-hidden': true })}
                                {modeLabel(activeDevice.mode)}
                                <ChevronDown size={14} className={`text-[var(--muted)] transition-transform ${isModeDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isModeDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsModeDropdownOpen(false)} />
                                    <div role="menu" className="absolute top-full left-0 mt-2 w-52 app-card p-1.5 z-50 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.8)]">
                                        {[DeviceMode.FERMENTER, DeviceMode.FRIDGE, DeviceMode.KEGERATOR].map(m => (
                                            <button
                                                key={m}
                                                type="button"
                                                role="menuitemradio"
                                                aria-checked={activeDevice.mode === m}
                                                onClick={() => handleModeDropdownSelect(m)}
                                                className={`w-full flex items-center gap-3 px-3 h-11 rounded-2xl text-left text-[15px] transition-colors hover:bg-[var(--fill)] ${activeDevice.mode === m ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}
                                            >
                                                {React.createElement(ModeIcon(m), { size: 16, 'aria-hidden': true })}
                                                <span className="flex-1">{modeLabel(m)}</span>
                                                {activeDevice.mode === m && <Check size={15} className="text-[var(--accent)]" />}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Abas (computador) */}
                <div className="hidden md:flex items-center gap-1 ml-auto rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.03)] p-1">
                    {tabs.map(t => (
                        <button
                            key={t.to}
                            type="button"
                            onClick={() => navigate(t.to)}
                            aria-current={t.active ? 'page' : undefined}
                            title={t.label}
                            className={`flex items-center gap-2 h-9 px-3.5 rounded-full text-[14px] transition-colors ${t.active ? 'bg-[var(--fill)] text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                        >
                            <t.icon size={16} aria-hidden />
                            <span className={activeDevice ? 'sr-only' : ''}>{t.label}</span>
                        </button>
                    ))}
                </div>
                {/* Foto do usuario (como no app): abre as Preferencias da conta */}
                <button
                    type="button"
                    onClick={() => navigate('/preferences')}
                    aria-label={`Conta de ${displayName || 'usuário'}: preferências`}
                    title={displayName || 'Conta'}
                    className="hidden md:inline-flex shrink-0 rounded-full transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
                >
                    <UserAvatar name={displayName} url={me?.avatarUrl} size={40} />
                </button>
                <button type="button" onClick={() => logout()} aria-label="Sair" title="Sair" className="hidden md:inline-flex app-icon-btn shrink-0 text-[var(--muted)]">
                    <LogOut size={17} />
                </button>

                {/* Menu (celular) */}
                <button
                    type="button"
                    aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
                    aria-expanded={isMobileMenuOpen}
                    className="md:hidden app-icon-btn ml-auto"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                    {isMobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
                </button>
            </div>

            {/* Aparelho aberto no celular: uma linha com estado e modo */}
            {activeDevice && (
                <div className="lg:hidden mx-auto max-w-7xl px-4 sm:px-6 pb-3 flex items-center gap-2 overflow-x-auto">
                    <span className="app-pill shrink-0">
                        <span aria-hidden className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[var(--accent)]' : 'bg-[var(--tertiary)]'}`} />
                        {stateLabel}
                    </span>
                    {[DeviceMode.FERMENTER, DeviceMode.FRIDGE, DeviceMode.KEGERATOR].map(m => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => handleModeDropdownSelect(m)}
                            aria-pressed={activeDevice.mode === m}
                            className={`app-pill shrink-0 ${activeDevice.mode === m ? '!bg-[var(--accent)] !text-[var(--on-accent)] !border-transparent' : 'text-[var(--muted)]'}`}
                        >
                            {React.createElement(ModeIcon(m), { size: 15, 'aria-hidden': true })}
                            {modeLabel(m)}
                        </button>
                    ))}
                </div>
            )}

            {isMobileMenuOpen && (
                <div role="dialog" aria-modal="true" aria-label="Menu" className="md:hidden fixed inset-x-0 top-16 bottom-0 z-50 bg-[#04070B] overflow-y-auto overscroll-contain p-4 flex flex-col gap-2">
                    {displayName && (
                        <div className="flex items-center gap-4 px-4 pb-3 mb-1 border-b border-[var(--line)]">
                            <UserAvatar name={displayName} url={me?.avatarUrl} size={48} />
                            <div className="min-w-0">
                                <div className="text-[17px] text-[var(--ink)] truncate">{displayName}</div>
                                {me?.email && <div className="text-[13px] text-[var(--muted)] truncate">{me.email}</div>}
                            </div>
                        </div>
                    )}
                    {tabs.map(t => (
                        <button
                            key={t.to}
                            type="button"
                            onClick={() => { setIsMobileMenuOpen(false); navigate(t.to); }}
                            aria-current={t.active ? 'page' : undefined}
                            className="app-row flex items-center gap-4 px-4 h-16 text-left text-[17px] hover:bg-[#1E2330] transition-colors"
                        >
                            <span className="app-icon-btn"><t.icon size={18} className={t.active ? 'text-[var(--accent)]' : ''} aria-hidden /></span>
                            <span className="flex-1">{t.label}</span>
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => { setIsMobileMenuOpen(false); logout(); }}
                        className="app-row flex items-center gap-4 px-4 h-16 text-left text-[17px] text-[var(--danger)] mt-4"
                    >
                        <span className="app-icon-btn"><LogOut size={18} aria-hidden /></span>
                        Sair
                    </button>
                </div>
            )}
        </nav>

        {/* Firmware novo: uma linha discreta, como no app (fora de Ajustes, que tem o proprio quadro) */}
        {hasUpdate && location.pathname !== '/settings' && (() => {
            const getDevProgress = (id: string) => otaProgress?.[(id || '').toUpperCase()] ?? otaProgress?.[id] ?? 0;
            const isUpdating = devicesNeedingUpdate.reduce((acc, dev) => Math.max(acc, getDevProgress(dev.id)), 0) > 0;
            return (
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 pt-4">
                    <div className="app-row border-[rgba(113,252,143,0.25)] flex items-center gap-3 px-4 py-3">
                        <span aria-hidden className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />
                        <p className="flex-1 text-[15px] text-[var(--ink)]">
                            Firmware {latestFirmware!.version} disponível
                            <span className="text-[var(--muted)]"> para este aparelho</span>
                        </p>
                        <button type="button" onClick={handleUpdateAll} disabled={isUpdating} className="text-[15px] font-medium text-[var(--accent)] disabled:text-[var(--tertiary)] px-2 h-9 rounded-full hover:bg-[var(--fill)] transition-colors">
                            {isUpdating ? 'Instalando…' : 'Atualizar'}
                        </button>
                    </div>
                </div>
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
            description={`Atualizar ${devicesNeedingUpdate[0]?.name || 'este aparelho'} para a versão ${latestFirmware?.version || ''}? Ele reinicia sozinho no fim.`}
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
        <div className="brew-landing brew-app app-shell min-h-screen min-h-[100dvh] text-[var(--ink)] [font-family:var(--font-body)] antialiased">
            <Toaster 
                position="top-right"
                toastOptions={{
                    style: {
                        background: '#20252F',
                        color: '#ECECF1',
                        border: '1px solid rgba(255,255,255,0.10)',
                        borderRadius: '16px',
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
                    {/* Home publica tambem para quem esta logado */}
                    <Route path="/home" element={<LandingApp />} />
                    <Route path="/home-nova" element={<Navigate to="/home" replace />} />
                    <Route path="/privacidade" element={<Privacy />} />
                    <Route path="/termos" element={<Terms />} />

                    {/* Protected App Routes */}
                    <Route path="/*" element={
                        <ProtectedRoute>
                            {/* O site inteiro usa a identidade do app (.app-shell no topo) */}
                            <div>
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
                                            <Route path="/settings" element={<Settings mode="device" />} />
                                            <Route path="/preferences" element={<Settings mode="preferences" />} />
                                            <Route path="/admin/*" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                                            <Route path="*" element={<Navigate to="/" replace />} />
                                        </Routes>
                                    </Suspense>
                                </ErrorBoundary>
                            </main>
                            </div>
                        </ProtectedRoute>
                    } />
                </Routes>
            </Suspense>
        </div>
    );
};

export default AppRoutes;
