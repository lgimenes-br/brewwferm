import { useState, useEffect } from 'react';
import { Battery, WifiOff, BellRing, HeartPulse, Megaphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';
import toast from 'react-hot-toast';

export const MarketingTab = () => {
    const { token } = useAuth();
    const [health, setHealth] = useState<any[]>([]);
    const [pushStats, setPushStats] = useState<any>({ total_users: 0, opt_in: 0 });
    const [pushTitle, setPushTitle] = useState('');
    const [pushMessage, setPushMessage] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        const fetchMarketing = async () => {
            const headers = { Authorization: `Bearer ${token}` };
            const baseUrl = API_URL;
            const signal = controller.signal;
            try {
                const [resHealth, resPush] = await Promise.all([
                    fetch(`${baseUrl}/admin/health-radar`, { headers, signal }),
                    fetch(`${baseUrl}/admin/push-stats`, { headers, signal })
                ]);
                if (signal.aborted) return;
                if ((resHealth.status === 401 || resPush.status === 401) && typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                    return;
                }
                if (resHealth.ok) {
                    const hData = await resHealth.json();
                    setHealth(Array.isArray(hData) ? hData : []);
                }
                if (resPush.ok) {
                    const pData = await resPush.json();
                    if (pData && typeof pData === 'object') setPushStats(pData);
                }
            } catch (e: any) {
                if (e?.name !== 'AbortError') {
                    console.error(e);
                }
            }
        };
        fetchMarketing();
        return () => controller.abort();
    }, [token]);

    const handleSendPush = async () => {
        if (!pushTitle || !pushMessage) return toast.error('Preencha título e mensagem');
        setSending(true);
        try {
            const baseUrl = API_URL;
            const res = await fetch(`${baseUrl}/admin/broadcast-push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ title: pushTitle, message: pushMessage })
            });
            if (res.status === 401 && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                return;
            }
            if (res.ok) {
                const data = await res.json();
                toast.success(`Push enviado para ${data.sent} dispositivos`);
                setPushTitle(''); setPushMessage('');
            } else {
                toast.error('Erro ao enviar push');
            }
        } catch (e) {
            toast.error('Erro de conexão');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-black text-white flex items-center gap-2 mb-6">
                <HeartPulse className="text-indigo-500" /> Radar de Saúde & Marketing
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Battery size={16} /> Radar de Dispositivos Problemáticos
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-neutral-800">
                                    <th className="py-2 px-3 text-xs font-bold text-neutral-500">Usuário</th>
                                    <th className="py-2 px-3 text-xs font-bold text-neutral-500">Device</th>
                                    <th className="py-2 px-3 text-xs font-bold text-neutral-500">Sinal</th>
                                    <th className="py-2 px-3 text-xs font-bold text-neutral-500">Bateria iSpindel</th>
                                </tr>
                            </thead>
                            <tbody>
                                {health.length > 0 ? health.map((d, i) => (
                                    <tr key={i} className="border-b border-neutral-800/50">
                                        <td className="py-3 px-3 text-white text-sm">{d.user_name}</td>
                                        <td className="py-3 px-3 text-neutral-400 text-sm font-mono">{d.serial_code}</td>
                                        <td className="py-3 px-3 text-sm">
                                            {d.rssi !== null && d.rssi !== undefined && !isNaN(Number(d.rssi)) ? (
                                                Number(d.rssi) < -80 ? (
                                                    <span className="text-red-400 flex items-center gap-1"><WifiOff size={14}/> {Number(d.rssi) === 0 ? 0 : Math.min(100, Math.max(0, 2 * (Number(d.rssi) + 100)))}%</span>
                                                ) : (
                                                    <span className="text-amber-400">{Number(d.rssi) === 0 ? 0 : Math.min(100, Math.max(0, 2 * (Number(d.rssi) + 100)))}%</span>
                                                )
                                            ) : '--'}
                                        </td>
                                        <td className="py-3 px-3 text-sm">
                                            {d.battery !== null && d.battery !== undefined && Number(d.battery) > 0 ? (
                                                Number(d.battery) < 3.4
                                                    ? <span className="text-red-400 font-bold">{Number(d.battery).toFixed(2)}V</span>
                                                    : <span className={Number(d.battery) < 3.7 ? "text-amber-400" : "text-emerald-400"}>{Number(d.battery).toFixed(2)}V</span>
                                            ) : '--'}
                                        </td>
                                    </tr>
                                )) : <tr><td colSpan={4} className="py-4 text-center text-neutral-500 text-sm">Nenhum dispositivo em estado crítico.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <BellRing size={16} /> Disparo de Push em Massa
                    </h3>
                    
                    <div className="flex items-center justify-between mb-6 p-4 bg-neutral-950 rounded-lg border border-neutral-800">
                        <div>
                            <div className="text-2xl font-bold text-white">{pushStats.opt_in}</div>
                            <div className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Usuários Opt-in</div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-neutral-400">{pushStats.total_users}</div>
                            <div className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Total da Base</div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="admin-push-title" className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Título do Push</label>
                            <input 
                                id="admin-push-title"
                                type="text" 
                                value={pushTitle}
                                onChange={(e) => setPushTitle(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 text-white rounded-lg p-3 outline-none focus:border-indigo-500 transition-all"
                                placeholder="Ex: Oferta Especial!"
                            />
                        </div>
                        <div>
                            <label htmlFor="admin-push-message" className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Mensagem</label>
                            <textarea 
                                id="admin-push-message"
                                value={pushMessage}
                                onChange={(e) => setPushMessage(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 text-white rounded-lg p-3 outline-none focus:border-indigo-500 transition-all h-24 resize-none"
                                placeholder="Digite sua mensagem para todos os usuários..."
                            ></textarea>
                        </div>
                        <button 
                            type="button"
                            onClick={handleSendPush}
                            disabled={sending}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all flex justify-center items-center gap-2"
                        >
                            {sending ? 'Enviando...' : <><Megaphone size={18} /> Enviar Push Broadcast</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
