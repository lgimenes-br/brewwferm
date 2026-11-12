import { useState } from 'react';
import { Users, TestTube, LogOut, Activity, Zap, Shield, Terminal, HeartPulse, Download, Boxes } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { OverviewTab } from './admin/OverviewTab';
import { TelemetryTab } from './admin/TelemetryTab';
import { UsersTab } from './admin/UsersTab';
import { SecurityTab } from './admin/SecurityTab';
import { FirmwareTab } from './admin/FirmwareTab';
import { FleetTab } from './admin/FleetTab';
import { IngredientsTab } from './admin/IngredientsTab';
import { TerminalTab } from './admin/TerminalTab';
import { MarketingTab } from './admin/MarketingTab';

export const AdminDashboard = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'telemetry' | 'users' | 'security' | 'firmware' | 'fleet' | 'ingredients' | 'terminal' | 'marketing'>('overview');

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-black text-neutral-300">
            {/* Top Bar exclusively for Admin */}
            <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-neutral-900/80">
                <div className="w-full px-4 md:px-10 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-baseline">
                            <span className="text-2xl font-black text-white tracking-tighter">BREW</span>
                            <div className="relative">
                                <span className="text-2xl font-black text-white tracking-tighter">W</span>
                                <div className="absolute top-0 -right-1 w-1.5 h-1 bg-white rounded-tr-sm"></div>
                            </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest border border-indigo-500/30">
                            Admin
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-2 min-w-0">
                        {/* Tab Buttons as Icons */}
                        <div role="tablist" aria-label="Abas do Painel Admin" className="flex items-center gap-2 mr-2 overflow-x-auto max-w-[65vw] md:max-w-none py-1">
                            <button type="button" role="tab" aria-selected={activeTab === 'overview'} aria-label="Visão Geral" onClick={() => setActiveTab('overview')} title="Visão Geral" className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all ${activeTab === 'overview' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white hover:bg-neutral-900'}`}>
                                <Activity size={18} />
                            </button>
                            <button type="button" role="tab" aria-selected={activeTab === 'telemetry'} aria-label="Telemetria" onClick={() => setActiveTab('telemetry')} title="Telemetria" className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all ${activeTab === 'telemetry' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white hover:bg-neutral-900'}`}>
                                <Zap size={18} />
                            </button>
                            <button type="button" role="tab" aria-selected={activeTab === 'users'} aria-label="Contas e Dispositivos" onClick={() => setActiveTab('users')} title="Contas e Dispositivos" className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all ${activeTab === 'users' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white hover:bg-neutral-900'}`}>
                                <Users size={18} />
                            </button>
                            <button type="button" role="tab" aria-selected={activeTab === 'security'} aria-label="Segurança e Avisos" onClick={() => setActiveTab('security')} title="Segurança e Avisos" className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all ${activeTab === 'security' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white hover:bg-neutral-900'}`}>
                                <Shield size={18} />
                            </button>
                            <button type="button" role="tab" aria-selected={activeTab === 'firmware'} aria-label="Firmware (OTA)" onClick={() => setActiveTab('firmware')} title="Firmware (OTA)" className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all ${activeTab === 'firmware' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white hover:bg-neutral-900'}`}>
                                <Download size={18} />
                            </button>
                            <button type="button" role="tab" aria-selected={activeTab === 'fleet'} aria-label="Frota" onClick={() => setActiveTab('fleet')} title="Frota" className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all ${activeTab === 'fleet' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white hover:bg-neutral-900'}`}>
                                <Boxes size={18} />
                            </button>
                            <button type="button" role="tab" aria-selected={activeTab === 'ingredients'} aria-label="Banco de Ingredientes" onClick={() => setActiveTab('ingredients')} title="Banco de Ingredientes" className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all ${activeTab === 'ingredients' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white hover:bg-neutral-900'}`}>
                                <TestTube size={18} />
                            </button>
                            <button type="button" role="tab" aria-selected={activeTab === 'terminal'} aria-label="Terminal do Servidor" onClick={() => setActiveTab('terminal')} title="Terminal do Servidor" className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all ${activeTab === 'terminal' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white hover:bg-neutral-900'}`}>
                                <Terminal size={18} />
                            </button>
                            <button type="button" role="tab" aria-selected={activeTab === 'marketing'} aria-label="Marketing e Saúde" onClick={() => setActiveTab('marketing')} title="Marketing e Saúde" className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all ${activeTab === 'marketing' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white hover:bg-neutral-900'}`}>
                                <HeartPulse size={18} />
                            </button>
                        </div>

                        <div className="hidden md:flex items-center gap-3 border-l border-neutral-800 pl-4 mr-2">
                            <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-300">
                                {String(user || 'A').charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-neutral-300">{String(user || 'Admin')}</span>
                        </div>
                        
                        <button 
                            type="button"
                            aria-label="Sair"
                            onClick={handleLogout}
                            title="Sair"
                            className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors border border-neutral-800 hover:border-red-500/20"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full px-4 md:px-10 py-8 animate-in fade-in duration-500">
                {activeTab === 'overview' && <OverviewTab />}
                {activeTab === 'telemetry' && <TelemetryTab />}
                {activeTab === 'users' && <UsersTab />}
                {activeTab === 'security' && <SecurityTab />}
                {activeTab === 'firmware' && <FirmwareTab />}
                {activeTab === 'fleet' && <FleetTab />}
                {activeTab === 'ingredients' && <IngredientsTab />}
                {activeTab === 'terminal' && <TerminalTab />}
                {activeTab === 'marketing' && <MarketingTab />}
            </div>
        </div>
    );
};
