import React, { useState, useEffect } from 'react';
import { Terminal, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

export const TerminalTab = () => {
    const { token } = useAuth();
    const [status, setStatus] = useState<any>(null);
    const [logs, setLogs] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const logsContainerRef = React.useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        setRefreshing(true);
        try {
            const statusRes = await fetch(`${API_URL}/admin/server/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (statusRes.status === 401 && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                return;
            }
            if (statusRes.ok) {
                const statusData = await statusRes.json();
                setStatus(Array.isArray(statusData) ? statusData : []);
            }

            const logsRes = await fetch(`${API_URL}/admin/server/logs`, {
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
        const interval = setInterval(() => {
            if (typeof document === 'undefined' || !document.hidden) {
                fetchData();
            }
        }, 10000); // Auto refresh every 10s when tab is visible
        return () => clearInterval(interval);
    }, [token]);

    useEffect(() => {
        if (logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
    }, [logs]);

    if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;

    const pm2Process = Array.isArray(status) && status.length > 0 ? status.find((p: any) => p.name === 'breww-server') || status[0] : null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Terminal className="text-indigo-500" size={24} /> 
                    Terminal & Processos
                </h2>
                <button 
                    type="button"
                    onClick={fetchData} 
                    disabled={refreshing}
                    className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <Activity size={16} className={refreshing ? 'animate-spin' : ''} />
                    Atualizar Agora
                </button>
            </div>

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

            <div className="bg-black border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
                <div className="bg-neutral-900 px-4 py-2 border-b border-neutral-800 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="ml-2 text-xs font-mono text-neutral-500">pm2 logs breww-server</span>
                </div>
                <div ref={logsContainerRef} className="p-4 h-[500px] overflow-y-auto overscroll-contain font-mono text-xs md:text-sm text-green-400 whitespace-pre-wrap break-all custom-scrollbar">
                    {logs || "Carregando logs..."}
                </div>
            </div>
        </div>
    );
};
