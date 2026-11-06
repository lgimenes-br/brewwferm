import React, { useState, useEffect } from 'react';
import { Megaphone, Terminal } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

export const SecurityTab: React.FC = () => {
    const { token } = useAuth();
    const [logs, setLogs] = useState<any[]>([]);
    const [broadcasts, setBroadcasts] = useState<any[]>([]);
    const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', type: 'info', is_active: true, send_push: false });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadData = () => {
        fetch(`${API_URL}/admin/audit`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                if (res.status === 401 && typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                }
                return res.ok ? res.json() : [];
            })
            .then(data => setLogs(Array.isArray(data) ? data : []))
            .catch(() => {});

        fetch(`${API_URL}/admin/broadcasts`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => (res.ok ? res.json() : []))
            .then(data => setBroadcasts(Array.isArray(data) ? data : []))
            .catch(() => {});
    };

    useEffect(() => { loadData(); }, [token]);

    const handleBroadcastSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/admin/broadcasts`, {
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
            const res = await fetch(`${API_URL}/admin/broadcasts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ is_active: !currentStatus })
            });
            if (res.ok) {
                loadData();
            } else {
                toast.error('Erro ao atualizar status do aviso');
            }
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
                            <input type="text" value={broadcastForm.title} onChange={e => setBroadcastForm({ ...broadcastForm, title: e.target.value })} className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" placeholder="Ex: Manutenção Programada" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Mensagem (obrigatório)</label>
                            <textarea required value={broadcastForm.message} onChange={e => setBroadcastForm({ ...broadcastForm, message: e.target.value })} className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 min-h-[80px]" placeholder="O servidor será reiniciado hoje às 23h..." />
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Tipo / Cor</label>
                                <select value={broadcastForm.type} onChange={e => setBroadcastForm({ ...broadcastForm, type: e.target.value })} className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 appearance-none">
                                    <option value="info">Informativo (Azul/Roxo)</option>
                                    <option value="warning">Alerta Crítico (Amarelo/Laranja)</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={broadcastForm.is_active} onChange={e => setBroadcastForm({ ...broadcastForm, is_active: e.target.checked })} className="rounded bg-neutral-800 border-neutral-700 text-indigo-500 focus:ring-indigo-500/20" />
                                <span className="text-sm font-medium text-neutral-300">Deixar Banner Ativo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={broadcastForm.send_push} onChange={e => setBroadcastForm({ ...broadcastForm, send_push: e.target.checked })} className="rounded bg-neutral-800 border-neutral-700 text-indigo-500 focus:ring-indigo-500/20" />
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
                                    type="button"
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
                            const actionStr = String(log.action || '');
                            const isFail = actionStr.includes('FAIL');
                            const isDelete = actionStr.includes('DELETE');
                            const isAuth = actionStr.includes('LOGIN');

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
