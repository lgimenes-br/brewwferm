import React, { useState, useEffect } from 'react';
import { Wifi } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

export const TelemetryTab: React.FC = () => {
    const { token } = useAuth();
    const [devices, setDevices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        fetch(`${API_URL}/admin/telemetry`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
        })
            .then(res => {
                if (res.status === 401 && typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                }
                return res.json();
            })
            .then(data => {
                if (controller.signal.aborted) return;
                setDevices(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch((err) => {
                if (err?.name === 'AbortError' || controller.signal.aborted) return;
                setLoading(false);
            });
        return () => controller.abort();
    }, [token]);

    if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="space-y-4">
            <div className="border border-black/[0.07] rounded-xl overflow-hidden bg-[var(--bg)] overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white">
                        <tr className="text-[var(--muted)]">
                            <th className="py-4 px-4 font-medium">Status</th>
                            <th className="py-4 px-4 font-medium">Dispositivo</th>
                            <th className="py-4 px-4 font-medium">Proprietário</th>
                            <th className="py-4 px-4 font-medium text-center">Última Temp.</th>
                            <th className="py-4 px-4 font-medium text-center">Bateria iSpindel</th>
                            <th className="py-4 px-4 font-medium text-center">WiFi (RSSI)</th>
                            <th className="py-4 px-4 font-medium">Último Sinal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.06]">
                        {devices.map(dev => {
                            const online = Boolean(dev.is_online);
                            return (
                                <tr key={dev.id} className="hover:bg-[var(--bg)] transition-colors">
                                    <td className="py-3 px-4">
                                        <div className={`flex items-center gap-2 ${online ? 'text-[#178a3f]' : 'text-[var(--muted)]'}`}>
                                            <div className={`w-2 h-2 rounded-full ${online ? 'bg-[#2fbf55] animate-pulse' : 'bg-black/20'}`}></div>
                                            <span className="text-xs font-semibold ">{online ? 'Online' : 'Offline'}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="font-mono text-[var(--ink)]">{dev.serial_code}</div>
                                        <div className="text-xs text-[var(--muted)]">{dev.device_name || 'Sem nome'}</div>
                                    </td>
                                    <td className="py-3 px-4 text-[#2b2f37]">{dev.owner_name}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="font-mono text-[#2b2f37] bg-[var(--bg)] px-2 py-1 rounded">
                                            {dev.last_temp !== null && dev.last_temp !== undefined && !isNaN(Number(dev.last_temp)) ? `${Number(dev.last_temp).toFixed(1)}°C` : '--'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        {dev.last_battery !== null && dev.last_battery !== undefined && Number(dev.last_battery) > 0 ? (
                                            <div className="flex items-center justify-center gap-1">
                                                <div className="w-6 h-3 border border-black/25 rounded-sm relative overflow-hidden">
                                                    <div
                                                        className={`h-full ${Number(dev.last_battery) < 3.4 ? 'bg-red-500' : Number(dev.last_battery) < 3.7 ? 'bg-amber-500' : 'bg-[#2fbf55]'}`}
                                                        style={{ width: `${Math.min(100, Math.max(0, ((Number(dev.last_battery) - 3.0) / 1.2) * 100))}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-xs font-mono text-[var(--muted)]">{Number(dev.last_battery).toFixed(2)}V</span>
                                            </div>
                                        ) : '--'}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        {dev.last_rssi !== null && dev.last_rssi !== undefined && !isNaN(Number(dev.last_rssi)) ? (
                                            <div className="flex flex-col items-center justify-center gap-0.5" title={`${dev.last_rssi} dBm`}>
                                                <Wifi size={16} className={
                                                    Number(dev.last_rssi) >= -65 ? 'text-[#178a3f]' :
                                                    Number(dev.last_rssi) >= -80 ? 'text-[#b45309]' : 'text-[#d63a4d]'
                                                } />
                                                <span className="text-[9px] font-mono text-[var(--muted)]">{Number(dev.last_rssi) === 0 ? 0 : Math.min(100, Math.max(0, 2 * (Number(dev.last_rssi) + 100)))}%</span>
                                            </div>
                                        ) : '--'}
                                    </td>
                                    <td className="py-3 px-4 text-[var(--muted)] text-xs">
                                        {dev.last_seen ? new Date(dev.last_seen).toLocaleString('pt-BR') : 'Nunca'}
                                    </td>
                                </tr>
                            );
                        })}
                        {devices.length === 0 && (
                            <tr><td colSpan={7} className="py-8 text-center text-[var(--muted)]">Nenhum dispositivo encontrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
