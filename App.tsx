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
import { LayoutGrid, History, Settings as SettingsIcon, LogOut, Circle, Snowflake, Flame, ArrowLeft, Timer } from 'lucide-react';
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

                {/* Right Side: Badges + Nav */}
                <div className="flex items-center gap-2">
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
                        </div>
                    )}

                    {/* Navigation Icons */}
                    <button title="Grid" onClick={() => navigate('/')} className={iconOnlyBase} >
                        <LayoutGrid size={18} />
                    </button>
                    <button title="Logs" onClick={() => navigate('/history')} className={iconOnlyBase} >
                        <History size={18} />
                    </button>
                    <button title="Settings" onClick={() => navigate('/settings')} className={iconOnlyBase}>
                        <SettingsIcon size={18} />
                    </button>

                    {/* Voltar Button - moved to the right corner */}
                    {(activeDevice || location.pathname.startsWith('/history') || location.pathname === '/settings') && (
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
