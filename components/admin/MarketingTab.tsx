import { useState, useEffect } from 'react';
import { Battery, WifiOff, BellRing, HeartPulse, Megaphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';
import toast from 'react-hot-toast';
import { WaitlistCard } from './WaitlistCard';
import { InstallFunnelCard } from './InstallFunnelCard';

export const MarketingTab = () => {
    const { token } = useAuth();
    const [health, setHealth] = useState<any[]>([]);
    const [pushStats, setPushStats] = useState<any>({ total_users: 0, opt_in: 0, phones: 0 });
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
                toast.success(`Notificação enviada para ${data.sent} conta(s)`);
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
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-black/[0.07] rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[var(--muted)] mb-6 flex items-center gap-2">
                        <Battery size={16} /> Radar de Dispositivos Problemáticos
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-black/[0.07]">
                                    <th className="py-2 px-3 text-xs font-semibold text-[var(--muted)]">Usuário</th>
                                    <th className="py-2 px-3 text-xs font-semibold text-[var(--muted)]">Device</th>
                                    <th className="py-2 px-3 text-xs font-semibold text-[var(--muted)]">Sinal</th>
                                    <th className="py-2 px-3 text-xs font-semibold text-[var(--muted)]">Bateria iSpindel</th>
                                </tr>
                            </thead>
                            <tbody>
                                {health.length > 0 ? health.map((d, i) => (
                                    <tr key={i} className="border-b border-black/[0.07]">
                                        <td className="py-3 px-3 text-[var(--ink)] text-sm">{d.user_name}</td>
                                        <td className="py-3 px-3 text-[var(--muted)] text-sm font-mono">{d.serial_code}</td>
                                        <td className="py-3 px-3 text-sm">
                                            {d.rssi !== null && d.rssi !== undefined && !isNaN(Number(d.rssi)) ? (
                                                Number(d.rssi) < -80 ? (
                                                    <span className="text-[#d63a4d] flex items-center gap-1"><WifiOff size={14}/> {Number(d.rssi) === 0 ? 0 : Math.min(100, Math.max(0, 2 * (Number(d.rssi) + 100)))}%</span>
                                                ) : (
                                                    <span className="text-[#b45309]">{Number(d.rssi) === 0 ? 0 : Math.min(100, Math.max(0, 2 * (Number(d.rssi) + 100)))}%</span>
                                                )
                                            ) : '--'}
                                        </td>
                                        <td className="py-3 px-3 text-sm">
                                            {d.battery !== null && d.battery !== undefined && Number(d.battery) > 0 ? (
                                                Number(d.battery) < 3.4
                                                    ? <span className="text-[#d63a4d] font-semibold">{Number(d.battery).toFixed(2)}V</span>
                                                    : <span className={Number(d.battery) < 3.7 ? "text-[#b45309]" : "text-[#178a3f]"}>{Number(d.battery).toFixed(2)}V</span>
                                            ) : '--'}
                                        </td>
                                    </tr>
                                )) : <tr><td colSpan={4} className="py-4 text-center text-[var(--muted)] text-sm">Nenhum dispositivo em estado crítico.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white border border-black/[0.07] rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[var(--muted)] mb-6 flex items-center gap-2">
                        <BellRing size={16} /> Disparo de Push em Massa
                    </h3>
                    
                    <div className="flex items-center justify-between mb-6 p-4 bg-[var(--bg)] rounded-lg border border-black/[0.07]">
                        <div>
                            <div className="text-2xl font-semibold text-[var(--ink)]">{pushStats.opt_in}</div>
                            <div className="text-xs text-[var(--muted)] font-semibold">Contas com notificações ligadas · {pushStats.phones ?? 0} celular(es) com o app</div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-semibold text-[var(--muted)]">{pushStats.total_users}</div>
                            <div className="text-xs text-[var(--muted)] font-semibold">Total da Base</div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="admin-push-title" className="block text-xs font-semibold text-[var(--muted)] mb-2">Título do Push</label>
                            <input 
                                id="admin-push-title"
                                type="text" 
                                value={pushTitle}
                                onChange={(e) => setPushTitle(e.target.value)}
                                className="w-full bg-[var(--bg)] border border-black/[0.07] text-[var(--ink)] rounded-lg p-3 outline-none focus:border-[var(--ink)] transition-all"
                                placeholder="Ex: Oferta Especial!"
                            />
                        </div>
                        <div>
                            <label htmlFor="admin-push-message" className="block text-xs font-semibold text-[var(--muted)] mb-2">Mensagem</label>
                            <textarea 
                                id="admin-push-message"
                                value={pushMessage}
                                onChange={(e) => setPushMessage(e.target.value)}
                                className="w-full bg-[var(--bg)] border border-black/[0.07] text-[var(--ink)] rounded-lg p-3 outline-none focus:border-[var(--ink)] transition-all h-24 resize-none"
                                placeholder="Digite sua mensagem para todos os usuários..."
                            ></textarea>
                        </div>
                        <button 
                            type="button"
                            onClick={handleSendPush}
                            disabled={sending}
                            className="w-full py-3 bg-[var(--ink)] hover:bg-black text-white font-semibold rounded-lg transition-all flex justify-center items-center gap-2"
                        >
                            {sending ? 'Enviando...' : <><Megaphone size={18} /> Enviar Push Broadcast</>}
                        </button>
                    </div>
                </div>
            </div>

            <InstallFunnelCard />
            <WaitlistCard />
        </div>
    );
};
