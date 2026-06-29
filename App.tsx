import React, { useState } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { FermenterDetailWrapper } from './components/FermenterDetailWrapper';
import { Toaster, toast } from 'react-hot-toast';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { FermentationHistory } from './components/FermentationHistory';
import { FinishedBrewDetailWrapper } from './components/FinishedBrewDetailWrapper';
import { Settings } from './components/Settings';
import { BrewingCalculators } from './components/BrewingCalculators';
import { CompareBatches } from './components/CompareBatches';
import { LayoutGrid, History, Settings as SettingsIcon, LogOut, Circle, Snowflake, Flame, ArrowLeft, Timer, FlaskConical, Beer, ChevronDown, Check, Calculator, Menu, X, GitCompare, Shield } from 'lucide-react';
import { DeviceMode } from './types';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute, PublicRoute, AdminRoute } from './components/AuthGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AdminDashboard } from './components/AdminDashboard';
import { useFermenters } from './hooks/useFermenters';
import { useBrew } from './context/BrewContext';
import { useLocation } from 'react-router-dom';
import { SystemBanner } from './components/SystemBanner';

const NavConfig = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, role } = useAuth();

    // If admin, we don't render this NavConfig. They get a full-screen admin experience.
    if (role === 'admin') return null;
    const { fermenters } = useFermenters();
    const { sendCommand, otaProgress, clearOtaProgress } = useBrew();
    const [latestFirmware, setLatestFirmware] = useState<{version: string, md5?: string, url?: string} | null>(null);

    React.useEffect(() => {
        const fetchFirmwareVersion = async () => {
            try {
                // We use ENV.API_URL from config or hardcode for now if ENV not imported.
                const baseUrl = window.location.origin;
                const res = await fetch(`${baseUrl}/firmware/version.json?t=${new Date().getTime()}`);
                if (res.ok) {
                    const data = await res.json();
                    setLatestFirmware(data);
                }
            } catch (e) {
                console.error('Erro ao buscar versão do firmware:', e);
            }
        };
        fetchFirmwareVersion();
    }, []);

    // Check if we are inside a device page
    const match = location.pathname.match(/\/fermenter\/(.+)/);
    const deviceId = match ? match[1] : null;
    const activeDevice = deviceId ? fermenters.find(f => f.id === deviceId) : null;

    const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleModeDropdownSelect = (mode: DeviceMode) => {
        setIsModeDropdownOpen(false);
        window.dispatchEvent(new CustomEvent('requestModeChange', { detail: { mode } }));
    };

    let isOnline = false;
    let statOp = 'INATIVO';
    
    if (activeDevice?.currentDevice) {
        const lastUpdate = new Date(activeDevice.currentDevice.lastUpdate).getTime();
        const now = new Date().getTime();
        isOnline = !isNaN(lastUpdate) && (now - lastUpdate) < 30 * 60 * 1000;
        statOp = (activeDevice.currentDevice.statOp || 'INATIVO').toUpperCase();
    }

    // Icon Styles
    const iconOnlyBase = "flex items-center justify-center w-9 h-9 rounded-md border transition-all shrink-0 border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white";

    // Check if any device needs an update
    const devicesNeedingUpdate = fermenters.filter(f => latestFirmware && f.currentDevice?.version && f.currentDevice.version !== latestFirmware.version);
    const hasUpdate = devicesNeedingUpdate.length > 0;

    const handleUpdateAll = () => {
        if (!latestFirmware) return;
        if (devicesNeedingUpdate.length === 0) return;
        
        if (confirm(`ATENÇÃO: Deseja iniciar a atualização para a versão ${latestFirmware.version} em ${devicesNeedingUpdate.length} equipamento(s)? Eles serão reiniciados.`)) {
            const apiUrl = import.meta.env.VITE_API_URL || window.location.origin + '/api';
            const finalUrl = latestFirmware.url || `${apiUrl}/firmware/update.bin`;
            devicesNeedingUpdate.forEach(device => {
                sendCommand(device.id, 'update_firmware', { url: finalUrl, md5: latestFirmware.md5 || '' });
            });
            toast.success(`Atualização enviada para ${devicesNeedingUpdate.length} dispositivo(s)!`);
        }
    };

    return (
        <div className="no-print mb-6">
        <nav className="bg-black py-4 md:py-6 border-b border-neutral-900">
            <div className="w-full mx-auto px-6 md:px-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Top Row for Mobile (Logo + Hamburger) */}
                <div className="flex items-center justify-between w-full md:w-auto">
                    {/* Left Side: Logo Only */}
                    <div className="flex items-center cursor-pointer select-none" onClick={() => navigate('/')}>
                        <div className="flex items-baseline">
                            <span className="text-4xl font-black text-white tracking-tighter">BREW</span>
                            <div className="relative">
                                <span className="text-4xl font-black text-white tracking-tighter">W</span>
                                <div className="absolute top-0 -right-2 w-3 h-2 bg-white rounded-tr-sm"></div>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Hamburger Button */}
                    <button 
                        className="md:hidden flex items-center justify-center w-10 h-10 text-neutral-400 hover:text-white transition-colors border border-neutral-800 rounded-md"
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
                            <div className={`flex items-center gap-2 px-3 h-9 rounded-md border font-mono text-[11px] font-semibold tracking-wider uppercase transition-all ${
                                isOnline 
                                    ? 'border-emerald-500 text-emerald-500' 
                                    : 'border-red-500 text-red-500'
                            }`}>
                                <div className={`w-2 h-2 rounded-full bg-current ${isOnline ? 'animate-pulse' : ''}`}></div>
                                {activeDevice.name}
                            </div>

                            {/* StatOp Badge */}
                            {statOp === 'AQUECENDO' && (
                                <div className="flex items-center gap-2 px-3 h-9 rounded-md border border-red-500 text-red-500 font-mono text-[11px] font-semibold tracking-wider uppercase">
                                    <Flame size={14} /> AQUECENDO
                                </div>
                            )}
                            {statOp === 'RESFRIANDO' && (
                                <div className="flex items-center gap-2 px-3 h-9 rounded-md border border-blue-500 text-blue-500 font-mono text-[11px] font-semibold tracking-wider uppercase">
                                    <Snowflake size={14} /> RESFRIANDO
                                </div>
                            )}
                            {statOp.startsWith('DELAY') && (
                                <div className="flex items-center gap-2 px-3 h-9 rounded-md border border-yellow-500 text-yellow-500 font-mono text-[11px] font-semibold tracking-wider uppercase">
                                    <Timer size={14} /> {statOp}
                                </div>
                            )}
                            {statOp === 'AGUARDANDO' && (
                                <div className="flex items-center gap-2 px-3 h-9 rounded-md border border-yellow-500 text-yellow-500 font-mono text-[11px] font-semibold tracking-wider uppercase">
                                    <Circle size={14} /> AGUARDANDO
                                </div>
                            )}
                            {(statOp !== 'AQUECENDO' && statOp !== 'RESFRIANDO' && statOp !== 'AGUARDANDO' && !statOp.startsWith('DELAY')) && (
                                <div className="flex items-center gap-2 px-3 h-9 rounded-md border border-zinc-500 text-zinc-500 font-mono text-[11px] font-semibold tracking-wider uppercase">
                                    <Circle size={14} /> {statOp === 'INATIVO' ? 'PARADO' : statOp}
                                </div>
                            )}

                            {/* MODE DROPDOWN Badge in Navbar */}
                            <div className="relative ml-1">
                                <button 
                                    onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                                    className="flex items-center gap-2 px-3 h-9 rounded-md border border-neutral-800 hover:border-neutral-600 bg-black text-neutral-300 hover:text-white transition-all"
                                >
                                    {activeDevice.mode === DeviceMode.FERMENTER && <FlaskConical size={14} />}
                                    {activeDevice.mode === DeviceMode.KEGERATOR && <Beer size={14} />}
                                    {activeDevice.mode === DeviceMode.FRIDGE && <Snowflake size={14} />}
                                    
                                    <span className="text-[11px] font-bold uppercase tracking-widest hidden lg:block">
                                        {activeDevice.mode === DeviceMode.FERMENTER ? 'Fermentador' : activeDevice.mode === DeviceMode.KEGERATOR ? 'Chopeira' : 'Geladeira'}
                                    </span>
                                    <ChevronDown size={14} className={`text-neutral-500 transition-transform ${isModeDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isModeDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsModeDropdownOpen(false)}></div>
                                        <div className="absolute top-full right-0 mt-2 w-48 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <button
                                                onClick={() => handleModeDropdownSelect(DeviceMode.FERMENTER)}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-800 transition-colors text-left"
                                            >
                                                <FlaskConical size={14} className={`transition-colors ${activeDevice.mode === DeviceMode.FERMENTER ? 'text-white' : 'text-neutral-500'}`} />
                                                <span className={`text-xs font-bold uppercase tracking-widest flex-1 transition-colors ${activeDevice.mode === DeviceMode.FERMENTER ? 'text-white' : 'text-neutral-400'}`}>Fermentador</span>
                                                {activeDevice.mode === DeviceMode.FERMENTER && <Check size={14} className="text-emerald-500" />}
                                            </button>
                                            <button
                                                onClick={() => handleModeDropdownSelect(DeviceMode.KEGERATOR)}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-800 transition-colors text-left"
                                            >
                                                <Beer size={14} className={`transition-colors ${activeDevice.mode === DeviceMode.KEGERATOR ? 'text-white' : 'text-neutral-500'}`} />
                                                <span className={`text-xs font-bold uppercase tracking-widest flex-1 transition-colors ${activeDevice.mode === DeviceMode.KEGERATOR ? 'text-white' : 'text-neutral-400'}`}>Chopeira</span>
                                                {activeDevice.mode === DeviceMode.KEGERATOR && <Check size={14} className="text-emerald-500" />}
                                            </button>
                                            <button
                                                onClick={() => handleModeDropdownSelect(DeviceMode.FRIDGE)}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-800 transition-colors text-left"
                                            >
                                                <Snowflake size={14} className={`transition-colors ${activeDevice.mode === DeviceMode.FRIDGE ? 'text-white' : 'text-neutral-500'}`} />
                                                <span className={`text-xs font-bold uppercase tracking-widest flex-1 transition-colors ${activeDevice.mode === DeviceMode.FRIDGE ? 'text-white' : 'text-neutral-400'}`}>Geladeira</span>
                                                {activeDevice.mode === DeviceMode.FRIDGE && <Check size={14} className="text-emerald-500" />}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Navigation Icons (Desktop only) */}
                    <div className="hidden md:flex items-center gap-2">
                        <button title="Grid" onClick={() => navigate('/')} className={iconOnlyBase} >
                            <LayoutGrid size={18} />
                        </button>
                        <button title="Logs" onClick={() => navigate('/history')} className={iconOnlyBase} >
                            <History size={18} />
                        </button>
                        <button title="Calculadoras" onClick={() => navigate('/calculators')} className={iconOnlyBase} >
                            <Calculator size={18} />
                        </button>
                        <button title="Comparador" onClick={() => navigate('/compare')} className={iconOnlyBase} >
                            <GitCompare size={18} />
                        </button>
                        <button title="Settings" onClick={() => navigate('/settings')} className={iconOnlyBase}>
                            <SettingsIcon size={18} />
                        </button>
                        
                        {role === 'admin' && (
                            <button title="Admin Panel" onClick={() => navigate('/admin')} className="flex items-center justify-center w-10 h-10 rounded-md border transition-all shrink-0 border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/20 hover:text-white">
                                <Shield size={18} />
                            </button>
                        )}

                        {/* Voltar Button - moved to the right corner */}
                        {(activeDevice || location.pathname.startsWith('/history') || location.pathname === '/settings' || location.pathname === '/calculators' || location.pathname === '/compare' || location.pathname.startsWith('/admin')) && (
                            <button title="Voltar" onClick={() => navigate(-1)} className={iconOnlyBase}>
                                <ArrowLeft size={18} />
                            </button>
                        )}

                        {location.pathname === '/' && (
                            <button onClick={() => logout()} className="ml-2 p-2 text-neutral-700 hover:text-red-500 transition-colors" title="Sair">
                                <LogOut size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 bg-black/95 flex flex-col md:hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between p-6 border-b border-neutral-900 bg-black">
                        <div className="flex items-baseline">
                            <span className="text-4xl font-black text-white tracking-tighter">BREW</span>
                            <div className="relative">
                                <span className="text-4xl font-black text-white tracking-tighter">W</span>
                                <div className="absolute top-0 -right-2 w-3 h-2 bg-white rounded-tr-sm"></div>
                            </div>
                        </div>
                        <button 
                            className="flex items-center justify-center w-10 h-10 text-neutral-400 hover:text-white transition-colors border border-neutral-800 rounded-md"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                        <button onClick={() => { setIsMobileMenuOpen(false); navigate('/'); }} className="flex items-center gap-4 p-4 text-white bg-neutral-900/50 hover:bg-neutral-800 rounded-xl transition-colors text-left border border-neutral-800">
                            <div className="flex items-center justify-center w-12 h-12 bg-neutral-800 rounded-lg text-white"><LayoutGrid size={24} /></div>
                            <span className="text-lg font-bold tracking-tight">Dashboard</span>
                        </button>
                        <button onClick={() => { setIsMobileMenuOpen(false); navigate('/history'); }} className="flex items-center gap-4 p-4 text-white bg-neutral-900/50 hover:bg-neutral-800 rounded-xl transition-colors text-left border border-neutral-800">
                            <div className="flex items-center justify-center w-12 h-12 bg-neutral-800 rounded-lg text-white"><History size={24} /></div>
                            <span className="text-lg font-bold tracking-tight">Histórico / Logs</span>
                        </button>
                        <button onClick={() => { setIsMobileMenuOpen(false); navigate('/calculators'); }} className="flex items-center gap-4 p-4 text-white bg-neutral-900/50 hover:bg-neutral-800 rounded-xl transition-colors text-left border border-neutral-800">
                            <div className="flex items-center justify-center w-12 h-12 bg-neutral-800 rounded-lg text-white"><Calculator size={24} /></div>
                            <span className="text-lg font-bold tracking-tight">Calculadoras</span>
                        </button>
                        <button onClick={() => { setIsMobileMenuOpen(false); navigate('/compare'); }} className="flex items-center gap-4 p-4 text-white bg-neutral-900/50 hover:bg-neutral-800 rounded-xl transition-colors text-left border border-neutral-800">
                            <div className="flex items-center justify-center w-12 h-12 bg-neutral-800 rounded-lg text-white"><GitCompare size={24} /></div>
                            <span className="text-lg font-bold tracking-tight">Comparar Lotes</span>
                        </button>
                        <button onClick={() => { setIsMobileMenuOpen(false); navigate('/settings'); }} className="flex items-center gap-4 p-4 text-white bg-neutral-900/50 hover:bg-neutral-800 rounded-xl transition-colors text-left border border-neutral-800">
                            <div className="flex items-center justify-center w-12 h-12 bg-neutral-800 rounded-lg text-white"><SettingsIcon size={24} /></div>
                            <span className="text-lg font-bold tracking-tight">Configurações</span>
                        </button>

                        {role === 'admin' && (
                            <button onClick={() => { setIsMobileMenuOpen(false); navigate('/admin'); }} className="flex items-center gap-4 p-4 text-indigo-400 bg-indigo-900/20 hover:bg-indigo-900/40 rounded-xl transition-colors text-left border border-indigo-500/20">
                                <div className="flex items-center justify-center w-12 h-12 bg-indigo-500/20 rounded-lg text-indigo-400"><Shield size={24} /></div>
                                <span className="text-lg font-bold tracking-tight">Admin Panel</span>
                            </button>
                        )}
                        
                        {(activeDevice || location.pathname.startsWith('/history') || location.pathname === '/settings' || location.pathname === '/calculators' || location.pathname.startsWith('/admin')) && (
                            <button onClick={() => { setIsMobileMenuOpen(false); navigate(-1); }} className="flex items-center gap-4 p-4 text-white bg-neutral-900/50 hover:bg-neutral-800 rounded-xl transition-colors text-left border border-neutral-800 mt-auto">
                                <div className="flex items-center justify-center w-12 h-12 bg-neutral-800 rounded-lg text-white"><ArrowLeft size={24} /></div>
                                <span className="text-lg font-bold tracking-tight">Voltar</span>
                            </button>
                        )}
                        
                        {location.pathname === '/' && (
                            <button onClick={() => { setIsMobileMenuOpen(false); logout(); }} className="flex items-center gap-4 p-4 text-red-500 bg-red-500/5 hover:bg-red-500/10 rounded-xl transition-colors text-left border border-red-500/20 mt-auto">
                                <div className="flex items-center justify-center w-12 h-12 bg-red-500/10 rounded-lg text-red-500"><LogOut size={24} /></div>
                                <span className="text-lg font-bold tracking-tight">Sair do Sistema</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </nav>
        
        {/* Global Firmware Alert */}
        {hasUpdate && location.pathname !== '/settings' && (() => {
            const maxProgress = devicesNeedingUpdate.reduce((acc, dev) => Math.max(acc, otaProgress?.[dev.id] || 0), 0);
            const isUpdating = maxProgress > 0;
            return (
                <>
                <div className="w-full bg-amber-950/40 border-b border-amber-900/50 py-3 px-6 md:px-10 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-500 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                        <p className="text-amber-500 text-xs md:text-sm font-medium">
                            Nova atualização de firmware ({latestFirmware!.version}) disponível para {devicesNeedingUpdate.length} equipamento{devicesNeedingUpdate.length > 1 ? 's' : ''}.
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handleUpdateAll}
                            disabled={isUpdating}
                            className="px-4 py-1.5 bg-amber-600/20 hover:bg-amber-600 disabled:opacity-50 border border-amber-600/50 text-amber-400 hover:text-white rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors shrink-0"
                        >
                            {isUpdating ? 'Instalando...' : 'Atualizar Agora'}
                        </button>
                    </div>
                </div>

                {isUpdating && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                        <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl shadow-2xl max-w-md w-full flex flex-col items-center animate-in zoom-in-95 duration-300">
                            {maxProgress === 100 ? (
                                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                                    <Check className="text-green-500" size={32} />
                                </div>
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
                                    <SettingsIcon className="text-amber-500 animate-spin" size={32} />
                                </div>
                            )}
                            
                            <h2 className="text-2xl font-bold text-white mb-2 text-center">
                                {maxProgress === 100 ? 'Atualização Concluída' : 'Atualizando Firmware'}
                            </h2>
                            <p className="text-neutral-400 text-sm text-center mb-8">
                                {maxProgress === 100 
                                    ? 'A placa está reiniciando e se reconectará em instantes. Você já pode fechar esta janela.' 
                                    : 'Por favor, não desligue a placa. O painel e o módulo WiFi serão reiniciados automaticamente ao concluir.'}
                            </p>
                            
                            <div className="w-full bg-neutral-950 rounded-full h-4 overflow-hidden border border-neutral-800 mb-2">
                                <div className={`h-4 rounded-full transition-all duration-300 relative overflow-hidden ${maxProgress === 100 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${maxProgress}%` }}>
                                    {maxProgress < 100 && <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>}
                                </div>
                            </div>
                            <div className="flex justify-between w-full text-xs font-bold mb-6">
                                <span className={maxProgress === 100 ? 'text-green-500' : 'text-amber-500'}>{maxProgress}% Concluído</span>
                                <span className="text-neutral-500">{devicesNeedingUpdate.length} equipamento(s)</span>
                            </div>
                            
                            <div className="w-full text-left bg-black rounded-xl p-3 border border-neutral-800 max-h-32 overflow-y-auto font-mono text-[10px] text-neutral-500 space-y-1 mb-6">
                                <div className="text-neutral-400 mb-2 border-b border-neutral-800 pb-1">Debug MQTT:</div>
                                {devicesNeedingUpdate.map(dev => (
                                    <div key={dev.id} className="flex justify-between py-1">
                                        <span>[{dev.id}] progresso OTA:</span>
                                        <span className={otaProgress?.[dev.id] === 100 ? 'text-green-500 font-bold' : 'text-amber-500 font-bold'}>
                                            {otaProgress?.[dev.id] || 0}%
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {maxProgress === 100 && (
                                <button 
                                    onClick={clearOtaProgress}
                                    className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition-colors uppercase tracking-wider text-sm"
                                >
                                    Fechar e Concluir
                                </button>
                            )}
                        </div>
                    </div>
                )}
                </>
            );
        })()}
        </div>
    );
};

const AppRoutes = () => {
    const { role } = useAuth();
    return (
        <div className="min-h-screen bg-black pb-10">
            <Toaster 
                position="top-right"
                toastOptions={{
                    style: {
                        background: '#171717',
                        color: '#fff',
                        border: '1px solid #262626'
                    }
                }}
            />
            <SystemBanner />
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

                {/* Protected App Routes */}
                <Route path="/*" element={
                    <ProtectedRoute>
                        <NavConfig />
                        <main className="mt-0">
                            <ErrorBoundary name="Rotas Principais">
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
                            </ErrorBoundary>
                        </main>
                    </ProtectedRoute>
                } />
            </Routes>
        </div>
    );
};

export default AppRoutes;
