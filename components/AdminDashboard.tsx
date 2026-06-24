import React, { useState, useEffect } from 'react';
import { Users, HardDrive, TestTube, Edit2, Trash2, Plus, X, Search, ChevronDown, ChevronRight, LogOut, ShieldAlert, Activity, Zap, Shield, Megaphone, Terminal, CheckCircle2, XCircle, Wifi } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

export const AdminDashboard = () => {
    const { token, logout, user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'telemetry' | 'users' | 'security' | 'ingredients' | 'terminal'>('overview');

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-black text-neutral-300">
            {/* Top Bar exclusively for Admin */}
            <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-neutral-900/80">
                <div className="max-w-7xl mx-auto px-4 md:px-10 h-16 flex items-center justify-between">
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
                    
                    <div className="flex items-center gap-2">
                        {/* Tab Buttons as Icons */}
                        <div className="flex items-center gap-2 mr-2">
                            <button onClick={() => setActiveTab('overview')} title="Visão Geral" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'overview' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white hover:bg-neutral-900'}`}>
                                <Activity size={18} />
                            </button>
                            <button onClick={() => setActiveTab('telemetry')} title="Telemetria" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'telemetry' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white hover:bg-neutral-900'}`}>
                                <Zap size={18} />
                            </button>
                            <button onClick={() => setActiveTab('users')} title="Contas e Dispositivos" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'users' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white hover:bg-neutral-900'}`}>
                                <Users size={18} />
                            </button>
                            <button onClick={() => setActiveTab('security')} title="Segurança e Avisos" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'security' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white hover:bg-neutral-900'}`}>
                                <Shield size={18} />
                            </button>
                            <button onClick={() => setActiveTab('ingredients')} title="Banco de Ingredientes" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'ingredients' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white hover:bg-neutral-900'}`}>
                                <TestTube size={18} />
                            </button>
                            <button onClick={() => setActiveTab('terminal')} title="Terminal do Servidor" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'terminal' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white hover:bg-neutral-900'}`}>
                                <Terminal size={18} />
                            </button>
                        </div>

                        <div className="hidden md:flex items-center gap-3 border-l border-neutral-800 pl-4 mr-2">
                            <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-300">
                                {user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-neutral-300">{user?.name}</span>
                        </div>
                        
                        <button 
                            onClick={handleLogout}
                            title="Sair"
                            className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors border border-neutral-800 hover:border-red-500/20"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-10 py-8 animate-in fade-in duration-500">
                {activeTab === 'overview' && <OverviewTab />}
                {activeTab === 'telemetry' && <TelemetryTab />}
                {activeTab === 'users' && <UsersTab />}
                {activeTab === 'security' && <SecurityTab />}
                {activeTab === 'ingredients' && <IngredientsTab />}
                {activeTab === 'terminal' && <TerminalTab />}
            </div>
        </div>
    );
};

// ==========================================
// OVERVIEW TAB
// ==========================================
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'];

const OverviewTab = () => {
    const { token } = useAuth();
    const [stats, setStats] = useState<any>({ total_users: 0, total_devices: 0, active_batches: 0, online_devices: 0 });
    const [analytics, setAnalytics] = useState<any>({ growth: [], firmwares: [], mau: 0, zombies: 0 });
    const [trends, setTrends] = useState<any>({ styles: [], total_batches: 0 });
    const [mapData, setMapData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const headers = { Authorization: `Bearer ${token}` };
                const baseUrl = import.meta.env.VITE_API_URL || window.location.origin + '/api';
                
                const [resStats, resAnalytics, resTrends, resMap] = await Promise.all([
                    fetch(`${baseUrl}/admin/stats`, { headers }),
                    fetch(`${baseUrl}/admin/analytics`, { headers }),
                    fetch(`${baseUrl}/admin/trends`, { headers }),
                    fetch(`${baseUrl}/admin/map`, { headers })
                ]);
                
                if (resStats.ok) setStats(await resStats.json());
                if (resAnalytics.ok) setAnalytics(await resAnalytics.json());
                if (resTrends.ok) setTrends(await resTrends.json());
                if (resMap.ok) setMapData(await resMap.json());
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token]);

    if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white mb-6">Métricas e Inteligência de Negócio</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                    <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-400 mb-3"><Users size={24} /></div>
                    <div className="text-3xl font-black text-white">{stats.total_users}</div>
                    <div className="text-xs text-neutral-500 uppercase tracking-widest font-bold mt-1">Total de Usuários</div>
                </div>
                
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl"></div>
                    <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400 mb-3 z-10"><Activity size={24} /></div>
                    <div className="text-3xl font-black text-white z-10">{analytics.mau || 0}</div>
                    <div className="text-xs text-neutral-500 uppercase tracking-widest font-bold mt-1 z-10">Usuários Ativos Mensais (MAU)</div>
                </div>
                
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl"></div>
                    <div className="p-3 bg-amber-500/10 rounded-full text-amber-400 mb-3 z-10"><TestTube size={24} /></div>
                    <div className="text-3xl font-black text-white z-10">{trends.total_batches || 0}</div>
                    <div className="text-xs text-neutral-500 uppercase tracking-widest font-bold mt-1 z-10">Lotes Históricos Fermentados</div>
                </div>
                
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl"></div>
                    <div className="p-3 bg-red-500/10 rounded-full text-red-400 mb-3 z-10"><Zap size={24} /></div>
                    <div className="text-3xl font-black text-white z-10">{analytics.zombies || 0}</div>
                    <div className="text-xs text-neutral-500 uppercase tracking-widest font-bold mt-1 z-10">Dispositivos Zumbis (>30 dias)</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-6">Crescimento de Usuários</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analytics.growth || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                                <XAxis dataKey="month" stroke="#737373" fontSize={12} />
                                <YAxis stroke="#737373" fontSize={12} />
                                <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px' }} />
                                <Line type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-6">Estilos de Cerveja Favoritos</h3>
                    <div className="h-64 w-full flex justify-center">
                        {(trends.styles && trends.styles.length > 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={trends.styles} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="count">
                                        {trends.styles.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center text-neutral-500">Sem dados suficientes</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-6">Mapa Global de Dispositivos</h3>
                    <div className="h-80 w-full bg-neutral-950 rounded-lg overflow-hidden border border-neutral-800">
                        <ComposableMap projectionConfig={{ scale: 140 }}>
                            <Geographies geography={geoUrl}>
                                {({ geographies }) => geographies.map(geo => (
                                    <Geography key={geo.rsmKey} geography={geo} fill="#171717" stroke="#262626" strokeWidth={0.5} />
                                ))}
                            </Geographies>
                            {mapData.map(({ name, lat, lon }) => (
                                <Marker key={name} coordinates={[lon, lat]}>
                                    <circle r={4} fill="#10b981" className="animate-pulse" />
                                    <circle r={2} fill="#059669" />
                                </Marker>
                            ))}
                        </ComposableMap>
                    </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-6">Versões de Firmware</h3>
                    <div className="space-y-4 mt-4">
                        {(analytics.firmwares && analytics.firmwares.length > 0) ? analytics.firmwares.map((fw: any, i: number) => (
                            <div key={i} className="flex flex-col gap-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-mono text-emerald-400">{fw.name}</span>
                                    <span className="text-neutral-400">{fw.count} disp.</span>
                                </div>
                                <div className="w-full bg-neutral-800 rounded-full h-2">
                                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min((fw.count / stats.total_devices) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center text-neutral-500 text-sm py-4">Nenhuma versão reportada via MQTT ainda.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// TELEMETRY TAB
// ==========================================
const TelemetryTab = () => {
    const { token } = useAuth();
    const [devices, setDevices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/telemetry`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => { setDevices(data); setLoading(false); })
        .catch(() => setLoading(false));
    }, [token]);

    if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-6">Monitoramento em Tempo Real</h2>
            <div className="border border-neutral-800 rounded-xl overflow-hidden bg-black/20 overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-neutral-900">
                        <tr className="text-neutral-400">
                            <th className="py-4 px-4 font-medium">Status</th>
                            <th className="py-4 px-4 font-medium">Dispositivo</th>
                            <th className="py-4 px-4 font-medium">Proprietário</th>
                            <th className="py-4 px-4 font-medium text-center">Última Temp.</th>
                            <th className="py-4 px-4 font-medium text-center">Bateria</th>
                            <th className="py-4 px-4 font-medium text-center">WiFi (RSSI)</th>
                            <th className="py-4 px-4 font-medium">Último Sinal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/50">
                        {devices.map(dev => {
                            const online = Boolean(dev.is_online);
                            return (
                                <tr key={dev.id} className="hover:bg-neutral-800/30 transition-colors">
                                    <td className="py-3 px-4">
                                        <div className={`flex items-center gap-2 ${online ? 'text-emerald-400' : 'text-neutral-500'}`}>
                                            <div className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'}`}></div>
                                            <span className="text-xs font-bold uppercase tracking-wider">{online ? 'Online' : 'Offline'}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="font-mono text-emerald-400">{dev.serial_code}</div>
                                        <div className="text-xs text-neutral-500">{dev.device_name || 'Sem nome'}</div>
                                    </td>
                                    <td className="py-3 px-4 text-neutral-300">{dev.owner_name}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="font-mono text-neutral-200 bg-neutral-800 px-2 py-1 rounded">
                                            {dev.last_temp !== null ? `${Number(dev.last_temp).toFixed(1)}°C` : '--'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        {dev.last_battery !== null ? (
                                            <div className="flex items-center justify-center gap-1">
                                                <div className="w-6 h-3 border border-neutral-600 rounded-sm relative overflow-hidden">
                                                    <div className="h-full bg-emerald-500" style={{ width: `${dev.last_battery}%` }}></div>
                                                </div>
                                                <span className="text-xs text-neutral-400">{dev.last_battery}%</span>
                                            </div>
                                        ) : '--'}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        {dev.last_rssi !== null ? (
                                            <div className="flex flex-col items-center justify-center gap-0.5" title={`${dev.last_rssi} dBm`}>
                                                <Wifi size={16} className={
                                                    dev.last_rssi >= -65 ? "text-emerald-500" :
                                                    dev.last_rssi >= -80 ? "text-amber-500" : "text-red-500"
                                                } />
                                                <span className="text-[9px] font-mono text-neutral-500">{dev.last_rssi}</span>
                                            </div>
                                        ) : '--'}
                                    </td>
                                    <td className="py-3 px-4 text-neutral-400 text-xs">
                                        {dev.last_seen ? new Date(dev.last_seen).toLocaleString('pt-BR') : 'Nunca'}
                                    </td>
                                </tr>
                            );
                        })}
                        {devices.length === 0 && (
                            <tr><td colSpan={6} className="py-8 text-center text-neutral-500">Nenhum dispositivo encontrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ==========================================
// SECURITY & BROADCASTS TAB
// ==========================================
const SecurityTab = () => {
    const { token } = useAuth();
    const [logs, setLogs] = useState<any[]>([]);
    const [broadcasts, setBroadcasts] = useState<any[]>([]);
    
    const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', type: 'info', is_active: true, send_push: false });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadData = () => {
        fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/audit`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => res.json()).then(setLogs).catch(() => {});
            
        fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/broadcasts`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => res.json()).then(setBroadcasts).catch(() => {});
    };

    useEffect(() => { loadData(); }, [token]);

    const handleBroadcastSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/broadcasts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(broadcastForm)
            });
            if (res.ok) {
                toast.success('Aviso disparado com sucesso!');
                setBroadcastForm({ title: '', message: '', type: 'info', is_active: true, send_push: false });
                loadData();
            } else {
                toast.error('Erro ao enviar aviso');
            }
        } catch (e) { toast.error('Falha na conexão'); }
        setIsSubmitting(false);
    };

    const toggleBroadcast = async (id: number, currentStatus: number) => {
        try {
            await fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/broadcasts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ is_active: !currentStatus })
            });
            loadData();
        } catch (e) { toast.error('Erro'); }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Col: Broadcasts */}
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        <Megaphone className="text-indigo-500" size={20} /> Enviar Aviso Global
                    </h2>
                    <p className="text-sm text-neutral-400 mb-6">Crie um banner ou notificação push para todos os usuários.</p>
                    
                    <form onSubmit={handleBroadcastSubmit} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Título do Aviso</label>
                            <input type="text" value={broadcastForm.title} onChange={e => setBroadcastForm({...broadcastForm, title: e.target.value})} className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" placeholder="Ex: Manutenção Programada" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Mensagem (obrigatório)</label>
                            <textarea required value={broadcastForm.message} onChange={e => setBroadcastForm({...broadcastForm, message: e.target.value})} className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 min-h-[80px]" placeholder="O servidor será reiniciado hoje às 23h..." />
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Tipo / Cor</label>
                                <select value={broadcastForm.type} onChange={e => setBroadcastForm({...broadcastForm, type: e.target.value})} className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 appearance-none">
                                    <option value="info">Informativo (Azul/Roxo)</option>
                                    <option value="warning">Alerta Crítico (Amarelo/Laranja)</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={broadcastForm.is_active} onChange={e => setBroadcastForm({...broadcastForm, is_active: e.target.checked})} className="rounded bg-neutral-800 border-neutral-700 text-indigo-500 focus:ring-indigo-500/20" />
                                <span className="text-sm font-medium text-neutral-300">Deixar Banner Ativo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={broadcastForm.send_push} onChange={e => setBroadcastForm({...broadcastForm, send_push: e.target.checked})} className="rounded bg-neutral-800 border-neutral-700 text-indigo-500 focus:ring-indigo-500/20" />
                                <span className="text-sm font-medium text-neutral-300">Disparar Notificação Push</span>
                            </label>
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-900/20 disabled:opacity-50 flex items-center justify-center gap-2">
                            <Megaphone size={16} /> {isSubmitting ? 'Enviando...' : 'Publicar Aviso'}
                        </button>
                    </form>
                </div>

                <div className="bg-black/20 border border-neutral-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-neutral-900 border-b border-neutral-800">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Histórico de Avisos</h3>
                    </div>
                    <div className="divide-y divide-neutral-800/50 max-h-64 overflow-y-auto">
                        {broadcasts.map(b => (
                            <div key={b.id} className="p-4 flex items-start justify-between gap-4 hover:bg-neutral-800/30">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`w-2 h-2 rounded-full ${b.type === 'warning' ? 'bg-amber-500' : 'bg-indigo-500'}`}></span>
                                        <span className="font-bold text-neutral-200 text-sm">{b.title || 'Aviso'}</span>
                                    </div>
                                    <p className="text-xs text-neutral-400 line-clamp-2">{b.message}</p>
                                    <p className="text-[10px] text-neutral-600 mt-1">{new Date(b.created_at).toLocaleString('pt-BR')}</p>
                                </div>
                                <button 
                                    onClick={() => toggleBroadcast(b.id, b.is_active)}
                                    className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider border ${
                                        b.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-neutral-800 text-neutral-500 border-neutral-700 hover:bg-neutral-700 hover:text-neutral-300'
                                    }`}
                                >
                                    {b.is_active ? 'Ativo' : 'Inativo'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Col: Audit Logs */}
            <div>
                <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <Terminal className="text-neutral-400" size={20} /> Logs de Auditoria
                </h2>
                <p className="text-sm text-neutral-400 mb-6">Registro de ações críticas do sistema para fins de segurança.</p>
                
                <div className="bg-black/40 border border-neutral-800 rounded-xl overflow-hidden flex flex-col h-[600px]">
                    <div className="px-4 py-3 bg-neutral-900 border-b border-neutral-800 flex justify-between items-center">
                        <span className="text-xs font-mono text-neutral-500">tail -f /var/log/audit.log</span>
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                            <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
                            <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
                        </div>
                    </div>
                    <div className="p-4 overflow-y-auto flex-1 font-mono text-xs space-y-3">
                        {logs.map(log => {
                            const isFail = log.action.includes('FAIL');
                            const isDelete = log.action.includes('DELETE');
                            const isAuth = log.action.includes('LOGIN');
                            
                            return (
                                <div key={log.id} className="flex items-start gap-3 border-b border-neutral-800/50 pb-2">
                                    <span className="text-neutral-600 shrink-0">{new Date(log.created_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                isFail ? 'bg-red-500/20 text-red-400' :
                                                isDelete ? 'bg-amber-500/20 text-amber-400' :
                                                isAuth ? 'bg-emerald-500/20 text-emerald-400' :
                                                'bg-indigo-500/20 text-indigo-400'
                                            }`}>{log.action}</span>
                                            <span className="text-neutral-400">by</span>
                                            <span className="text-indigo-300">{log.user_name || `User #${log.user_id}`}</span>
                                        </div>
                                        <div className="text-neutral-300">{log.details}</div>
                                        <div className="text-neutral-600 text-[10px] mt-0.5">IP: {log.ip_address}</div>
                                    </div>
                                </div>
                            );
                        })}
                        {logs.length === 0 && <div className="text-neutral-600">Nenhum log registrado.</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// USERS & DEVICES TAB (ACCORDION)
// ==========================================

const UsersTab = () => {
    const { token } = useAuth();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

    // Modals
    const [userModal, setUserModal] = useState<{isOpen: boolean, data: any}>({ isOpen: false, data: null });
    const [deviceModal, setDeviceModal] = useState<{isOpen: boolean, data: any, userId: number | null}>({ isOpen: false, data: null, userId: null });

    const loadUsers = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setUsers(await res.json());
            }
        } catch (e) {
            toast.error('Erro ao carregar usuários');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadUsers(); }, [token]);

    const toggleExpand = (id: number) => {
        setExpandedUserId(prev => prev === id ? null : id);
    };

    const deleteUser = async (id: number) => {
        if (!window.confirm('ATENÇÃO: Deletar este usuário apagará TODOS os dispositivos, lotes e leituras dele. Continuar?')) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/users/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success('Usuário apagado com sucesso');
                loadUsers();
            } else {
                const err = await res.json();
                toast.error(`Erro do Servidor: ${err.error}`);
            }
        } catch (e: any) { toast.error(`Falha ao deletar: ${e.message}`); }
    };

    const changeUserPlan = async (id: number, plan_type: string) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/users/${id}/plan`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ plan_type })
            });
            if (res.ok) {
                toast.success('Plano atualizado');
                loadUsers();
            } else throw new Error();
        } catch (e) { toast.error('Falha ao atualizar plano'); }
    };

    const deleteDevice = async (id: number) => {
        if (!window.confirm('Remover este dispositivo?')) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/devices/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success('Dispositivo removido');
                setExpandedUserId(prev => prev);
                loadUsers();
            } else throw new Error();
        } catch (e) { toast.error('Falha ao remover dispositivo'); }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Gerenciamento de Contas</h2>
                <button 
                    onClick={() => setUserModal({ isOpen: true, data: null })}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-900/20"
                >
                    <Plus size={16} /> Nova Conta
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
                <div className="border border-neutral-800 rounded-xl overflow-hidden bg-black/20">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-900">
                            <tr className="text-neutral-400">
                                <th className="py-4 px-4 font-medium w-10"></th>
                                <th className="py-4 px-4 font-medium">Nome</th>
                                <th className="py-4 px-4 font-medium">Email</th>
                                <th className="py-4 px-4 font-medium">Role</th>
                                <th className="py-4 px-4 font-medium text-center">Plano</th>
                                <th className="py-4 px-4 font-medium text-center">Dispositivos</th>
                                <th className="py-4 px-4 font-medium text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/50">
                            {users.map(user => (
                                <React.Fragment key={user.id}>
                                    <tr className={`hover:bg-neutral-800/30 transition-colors ${expandedUserId === user.id ? 'bg-neutral-800/20' : ''}`}>
                                        <td className="py-3 px-4">
                                            <button 
                                                onClick={() => toggleExpand(user.id)}
                                                className="p-1 hover:bg-neutral-700 rounded text-neutral-400"
                                            >
                                                {expandedUserId === user.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                            </button>
                                        </td>
                                        <td className="py-3 px-4 font-medium text-neutral-200">{user.name}</td>
                                        <td className="py-3 px-4 text-neutral-400">{user.email}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${user.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-neutral-800 text-neutral-400 border border-neutral-700'}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <select 
                                                value={user.plan_type || 'free'} 
                                                onChange={(e) => changeUserPlan(user.id, e.target.value)}
                                                className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="free">Free</option>
                                                <option value="premium">Premium</option>
                                            </select>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-neutral-800 text-xs font-bold text-neutral-300">
                                                {user.device_count || 0}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => setUserModal({ isOpen: true, data: user })} className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-amber-400/10 rounded transition-colors"><Edit2 size={16} /></button>
                                                <button onClick={() => deleteUser(user.id)} className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                    
                                    {/* Inline Devices Accordion */}
                                    {expandedUserId === user.id && (
                                        <tr>
                                            <td colSpan={6} className="p-0 border-b border-neutral-800">
                                                <div className="bg-black/40 px-4 md:px-10 py-6 border-l-2 border-indigo-500 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2 uppercase tracking-widest">
                                                            <HardDrive size={14} className="text-indigo-500" />
                                                            Dispositivos Vinculados
                                                        </h3>
                                                        <button 
                                                            onClick={() => setDeviceModal({ isOpen: true, data: null, userId: user.id })}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md text-xs font-medium transition-colors border border-neutral-700"
                                                        >
                                                            <Plus size={14} /> Adicionar
                                                        </button>
                                                    </div>
                                                    
                                                    <UserDevicesList userId={user.id} onEdit={(dev) => setDeviceModal({ isOpen: true, data: dev, userId: user.id })} onDelete={deleteDevice} />
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {users.length === 0 && !loading && (
                                <tr><td colSpan={6} className="py-8 text-center text-neutral-500">Nenhum usuário encontrado.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modals */}
            {userModal.isOpen && (
                <UserFormModal 
                    data={userModal.data} 
                    onClose={() => setUserModal({ isOpen: false, data: null })} 
                    onSuccess={() => { loadUsers(); setUserModal({ isOpen: false, data: null }); }} 
                />
            )}
            {deviceModal.isOpen && (
                <DeviceFormModal 
                    data={deviceModal.data} 
                    userId={deviceModal.userId!} 
                    onClose={() => setDeviceModal({ isOpen: false, data: null, userId: null })} 
                    onSuccess={() => { loadUsers(); setDeviceModal({ isOpen: false, data: null, userId: null }); }} 
                />
            )}
        </div>
    );
};

// Component to load devices for a specific user
const UserDevicesList = ({ userId, onEdit, onDelete }: { userId: number, onEdit: (dev: any) => void, onDelete: (id: number) => void }) => {
    const { token } = useAuth();
    const [devices, setDevices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/devices`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => { 
            setDevices(data.filter((d: any) => d.user_id === userId)); 
            setLoading(false);
        });
    }, [token, userId]);

    return loading ? (
        <div className="text-xs text-neutral-500 py-2">Carregando...</div>
    ) : devices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {devices.map(dev => (
                <div key={dev.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 flex justify-between items-center group hover:border-neutral-700 transition-colors">
                    <div>
                        <div className="font-mono text-emerald-400 text-sm">{dev.serial_code}</div>
                        <div className="text-xs text-neutral-500">{dev.device_name || 'Sem nome'}</div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(dev)} className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-amber-400/10 rounded"><Edit2 size={14} /></button>
                        <button onClick={() => onDelete(dev.id)} className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded"><Trash2 size={14} /></button>
                    </div>
                </div>
            ))}
        </div>
    ) : (
        <div className="text-sm text-neutral-500 py-4 border border-dashed border-neutral-800 rounded-lg text-center bg-black/20">
            Nenhum equipamento vinculado a esta conta.
        </div>
    );
};


// ==========================================
// MODALS
// ==========================================

const UserFormModal = ({ data, onClose, onSuccess }: { data: any, onClose: () => void, onSuccess: () => void }) => {
    const { token } = useAuth();
    const [formData, setFormData] = useState({
        name: data?.name || '',
        email: data?.email || '',
        password: '',
        role: data?.role || 'user'
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = data 
                ? `${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/users/${data.id}`
                : `${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/users`;
            
            const res = await fetch(url, {
                method: data ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success(data ? 'Usuário atualizado!' : 'Usuário criado!');
                onSuccess();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Erro ao salvar');
            }
        } catch (e) { toast.error('Falha de conexão'); }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">{data ? 'Editar Conta' : 'Nova Conta'}</h3>
                    <button onClick={onClose} className="text-neutral-500 hover:text-white"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Nome</label>
                        <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Email</label>
                        <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">{data ? 'Nova Senha (opcional)' : 'Senha'}</label>
                        <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!data} className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Nível de Acesso</label>
                        <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 appearance-none">
                            <option value="user">Usuário Comum</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors">Cancelar</button>
                        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const DeviceFormModal = ({ data, userId, onClose, onSuccess }: { data: any, userId: number, onClose: () => void, onSuccess: () => void }) => {
    const { token } = useAuth();
    const [formData, setFormData] = useState({
        serial_code: data?.serial_code || '',
        device_name: data?.device_name || '',
        user_id: userId
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = data 
                ? `${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/devices/${data.id}`
                : `${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/devices`;
            
            const res = await fetch(url, {
                method: data ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success('Dispositivo salvo!');
                onSuccess();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Erro ao salvar');
            }
        } catch (e) { toast.error('Falha de conexão'); }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">{data ? 'Editar Dispositivo' : 'Vincular Dispositivo'}</h3>
                    <button onClick={onClose} className="text-neutral-500 hover:text-white"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Serial (Código Único)</label>
                        <input type="text" value={formData.serial_code} onChange={e => setFormData({...formData, serial_code: e.target.value})} required className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono uppercase" placeholder="BREWW-XXXXX" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Apelido (Opcional)</label>
                        <input type="text" value={formData.device_name} onChange={e => setFormData({...formData, device_name: e.target.value})} className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" placeholder="Ex: Geladeira 1" />
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors">Cancelar</button>
                        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// ==========================================
// INGREDIENTS TAB (KEEPING EXISTING LOGIC)
// ==========================================

const IngredientsTab = () => {
    const { token } = useAuth();
    const [subTab, setSubTab] = useState<'fermentables' | 'hops' | 'yeasts' | 'miscs'>('fermentables');
    const [ingredients, setIngredients] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Search & Edit state
    const [searchTerm, setSearchTerm] = useState('');
    const [editingItem, setEditingItem] = useState<any | null>(null);

    const loadIngredients = () => {
        setLoading(true);
        fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/ingredients/${subTab}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => { setIngredients(data); setLoading(false); })
        .catch(err => { toast.error('Erro ao carregar'); setLoading(false); });
    };

    useEffect(() => { loadIngredients(); }, [subTab, token]);

    const handleSave = async (id: number | null, name: string, namePt: string) => {
        try {
            const method = id ? 'PUT' : 'POST';
            const url = id 
                ? `${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/ingredients/${subTab}/${id}`
                : `${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/ingredients/${subTab}`;
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name, name_pt: namePt })
            });

            if (!res.ok) throw new Error('Falha ao salvar');
            toast.success('Ingrediente salvo!');
            setEditingItem(null);
            loadIngredients();
        } catch (err) {
            toast.error('Erro ao salvar');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Excluir este ingrediente?')) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/ingredients/${subTab}/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Falha');
            toast.success('Ingrediente excluído!');
            loadIngredients();
        } catch (err) { toast.error('Erro ao excluir'); }
    };

    const filtered = ingredients.filter(i => 
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (i.name_pt && i.name_pt.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex space-x-1 bg-black/50 p-1 rounded-lg border border-neutral-800 w-full md:w-auto overflow-x-auto">
                    {[
                        { id: 'fermentables', label: 'Fermentáveis' },
                        { id: 'hops', label: 'Lúpulos' },
                        { id: 'yeasts', label: 'Leveduras' },
                        { id: 'miscs', label: 'Outros' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setSubTab(tab.id as any); setSearchTerm(''); }}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                                subTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                            <Search size={14} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-black/50 border border-neutral-800 text-neutral-300 rounded-lg py-2 pl-9 pr-4 focus:outline-none focus:border-indigo-500 text-sm transition-colors"
                        />
                    </div>
                    <button 
                        onClick={() => setEditingItem({ id: null, name: '', name_pt: '' })}
                        className="flex items-center justify-center w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shrink-0 shadow-lg shadow-indigo-900/20"
                        title="Adicionar Novo"
                    >
                        <Plus size={18} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
                <div className="border border-neutral-800 rounded-xl overflow-hidden bg-black/20">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-900">
                            <tr className="text-neutral-400">
                                <th className="py-4 px-4 font-medium">Nome Original</th>
                                <th className="py-4 px-4 font-medium">Nome (PT-BR)</th>
                                <th className="py-4 px-4 font-medium text-right w-24">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/50 text-neutral-300">
                            {filtered.map(item => (
                                <tr key={item.id} className="hover:bg-neutral-800/30 transition-colors">
                                    <td className="py-3 px-4">{item.name}</td>
                                    <td className="py-3 px-4 text-indigo-400 font-medium">{item.name_pt || '-'}</td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => setEditingItem(item)} className="p-1.5 text-neutral-500 hover:text-amber-400 hover:bg-amber-400/10 rounded transition-colors"><Edit2 size={14} /></button>
                                            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={3} className="py-8 text-center text-neutral-500">Nenhum ingrediente encontrado.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {editingItem && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white">{editingItem.id ? 'Editar Ingrediente' : 'Novo Ingrediente'}</h3>
                            <button onClick={() => setEditingItem(null)} className="text-neutral-500 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Nome Original (Inglês)</label>
                                <input 
                                    type="text" 
                                    value={editingItem.name} 
                                    onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                                    className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Nome PT-BR</label>
                                <input 
                                    type="text" 
                                    value={editingItem.name_pt || ''} 
                                    onChange={e => setEditingItem({...editingItem, name_pt: e.target.value})}
                                    className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" 
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button onClick={() => setEditingItem(null)} className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors">Cancelar</button>
                                <button 
                                    onClick={() => handleSave(editingItem.id, editingItem.name, editingItem.name_pt)} 
                                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==========================================
// TERMINAL TAB
// ==========================================
const TerminalTab = () => {
    const { token } = useAuth();
    const [status, setStatus] = useState<any>(null);
    const [logs, setLogs] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const logsEndRef = React.useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        setRefreshing(true);
        try {
            const statusRes = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/server/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (statusRes.ok) {
                const statusData = await statusRes.json();
                setStatus(statusData);
            }

            const logsRes = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/server/logs`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (logsRes.ok) {
                const logsText = await logsRes.text();
                setLogs(logsText);
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
        setRefreshing(false);
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Auto refresh every 10s
        return () => clearInterval(interval);
    }, [token]);

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;

    const pm2Process = status && status.length > 0 ? status.find((p: any) => p.name === 'breww-server') || status[0] : null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Terminal className="text-indigo-500" size={24} /> 
                    Terminal & Processos
                </h2>
                <button 
                    onClick={fetchData} 
                    disabled={refreshing}
                    className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <Activity size={16} className={refreshing ? 'animate-spin' : ''} />
                    Atualizar Agora
                </button>
            </div>

            {/* Status Cards */}
            {pm2Process && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col items-center text-center">
                        <div className="text-sm text-neutral-500 mb-1">Status do Processo</div>
                        <div className={`text-xl font-bold flex items-center gap-2 ${pm2Process.pm2_env?.status === 'online' ? 'text-green-500' : 'text-red-500'}`}>
                            <span className={`w-3 h-3 rounded-full ${pm2Process.pm2_env?.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                            {pm2Process.pm2_env?.status?.toUpperCase()}
                        </div>
                    </div>
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col items-center text-center">
                        <div className="text-sm text-neutral-500 mb-1">Uso de CPU</div>
                        <div className="text-xl font-bold text-white">{pm2Process.monit?.cpu || 0}%</div>
                    </div>
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col items-center text-center">
                        <div className="text-sm text-neutral-500 mb-1">Memória RAM</div>
                        <div className="text-xl font-bold text-white">{Math.round((pm2Process.monit?.memory || 0) / 1024 / 1024)} MB</div>
                    </div>
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col items-center text-center">
                        <div className="text-sm text-neutral-500 mb-1">Reinicializações</div>
                        <div className="text-xl font-bold text-amber-500">{pm2Process.pm2_env?.restart_time || 0}</div>
                    </div>
                </div>
            )}

            {/* Terminal Window */}
            <div className="bg-black border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
                <div className="bg-neutral-900 px-4 py-2 border-b border-neutral-800 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="ml-2 text-xs font-mono text-neutral-500">pm2 logs breww-server</span>
                </div>
                <div className="p-4 h-[500px] overflow-y-auto font-mono text-xs md:text-sm text-green-400 whitespace-pre-wrap break-all custom-scrollbar">
                    {logs || "Carregando logs..."}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
};
