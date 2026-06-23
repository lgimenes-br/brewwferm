import React, { useState } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { FermenterDetailWrapper } from './components/FermenterDetailWrapper';
import { Toaster } from 'react-hot-toast';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { FermentationHistory } from './components/FermentationHistory';
import { FinishedBrewDetailWrapper } from './components/FinishedBrewDetailWrapper';
import { Settings } from './components/Settings';
import { BrewingCalculators } from './components/BrewingCalculators';
import { LayoutGrid, History, Settings as SettingsIcon, LogOut, Circle, Snowflake, Flame, ArrowLeft, Timer, FlaskConical, Beer, ChevronDown, Check, Calculator, Menu, X } from 'lucide-react';
import { DeviceMode } from './types';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute, PublicRoute } from './components/AuthGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useFermenters } from './hooks/useFermenters';
import { useLocation } from 'react-router-dom';

const NavConfig = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useAuth();
    const { fermenters } = useFermenters();

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
    const iconOnlyBase = "flex items-center justify-center w-10 h-10 rounded-md border transition-all shrink-0 border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white";

    return (
        <nav className="bg-black py-4 md:py-6 no-print border-b border-neutral-900 mb-6">
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
                <div className={`${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300 md:animate-none`}>
                    {/* Contextual Badges for Device Pages */}
                    {activeDevice && (
                        <div className="hidden md:flex items-center gap-2 mr-3 animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* Online/Offline Badge */}
                            <div className={`flex items-center gap-2 px-3 h-10 rounded-md border font-mono text-[11px] font-semibold tracking-wider uppercase transition-all ${
                                isOnline 
                                    ? 'border-emerald-500 text-emerald-500' 
                                    : 'border-red-500 text-red-500'
                            }`}>
                                <div className={`w-2 h-2 rounded-full bg-current ${isOnline ? 'animate-pulse' : ''}`}></div>
                                {isOnline ? 'ONLINE' : 'OFFLINE'}
                            </div>

                            {/* StatOp Badge */}
                            {statOp === 'AQUECENDO' && (
                                <div className="flex items-center gap-2 px-3 h-10 rounded-md border border-red-500 text-red-500 font-mono text-[11px] font-semibold tracking-wider uppercase">
                                    <Flame size={14} /> AQUECENDO
                                </div>
                            )}
                            {statOp === 'RESFRIANDO' && (
                                <div className="flex items-center gap-2 px-3 h-10 rounded-md border border-blue-500 text-blue-500 font-mono text-[11px] font-semibold tracking-wider uppercase">
                                    <Snowflake size={14} /> RESFRIANDO
                                </div>
                            )}
                            {statOp === 'DELAY' && (
                                <div className="flex items-center gap-2 px-3 h-10 rounded-md border border-orange-500 text-orange-500 font-mono text-[11px] font-semibold tracking-wider uppercase">
                                    <Timer size={14} /> DELAY
                                </div>
                            )}
                            {(statOp !== 'AQUECENDO' && statOp !== 'RESFRIANDO' && statOp !== 'DELAY') && (
                                <div className="flex items-center gap-2 px-3 h-10 rounded-md border border-zinc-500 text-zinc-500 font-mono text-[11px] font-semibold tracking-wider uppercase">
                                    <Circle size={14} /> {statOp === 'INATIVO' ? 'PARADO' : statOp}
                                </div>
                            )}

                            {/* MODE DROPDOWN Badge in Navbar */}
                            <div className="relative ml-1">
                                <button 
                                    onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                                    className="flex items-center gap-2 px-3 h-10 rounded-md border border-neutral-800 hover:border-neutral-600 bg-black text-neutral-300 hover:text-white transition-all"
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

                    {/* Navigation Icons */}
                    <button title="Grid" onClick={() => navigate('/')} className={iconOnlyBase} >
                        <LayoutGrid size={18} />
                    </button>
                    <button title="Logs" onClick={() => navigate('/history')} className={iconOnlyBase} >
                        <History size={18} />
                    </button>
                    <button title="Calculadoras" onClick={() => navigate('/calculators')} className={iconOnlyBase} >
                        <Calculator size={18} />
                    </button>
                    <button title="Settings" onClick={() => navigate('/settings')} className={iconOnlyBase}>
                        <SettingsIcon size={18} />
                    </button>

                    {/* Voltar Button - moved to the right corner */}
                    {(activeDevice || location.pathname.startsWith('/history') || location.pathname === '/settings' || location.pathname === '/calculators') && (
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
        </nav>
    );
};

const AppRoutes = () => {
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
                                    <Route path="/" element={<Dashboard />} />
                                    <Route path="/fermenter/:id" element={<FermenterDetailWrapper />} />
                                    <Route path="/history" element={<FermentationHistory />} />
                                    <Route path="/history/:id" element={<FinishedBrewDetailWrapper />} />
                                    <Route path="/calculators" element={<BrewingCalculators />} />
                                    <Route path="/settings" element={<Settings />} />
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
