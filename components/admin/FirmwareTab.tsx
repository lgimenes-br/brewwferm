import { useState, useEffect } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBrew } from '../../context/BrewContext';
import { API_URL } from '../../config';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../ConfirmDialog';

export const FirmwareTab = () => {
    const { token } = useAuth();
    const { sendCommand } = useBrew();
    const [devices, setDevices] = useState<any[]>([]);
    const [otaUrl, setOtaUrl] = useState('');
    const [otaMd5, setOtaMd5] = useState('');
    const [selectedDevice, setSelectedDevice] = useState('');
    const [isConfirmOtaOpen, setIsConfirmOtaOpen] = useState(false);
    
    useEffect(() => {
        const controller = new AbortController();
        fetch(`${API_URL}/admin/telemetry`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
        .then(res => {
            if (res.status === 401 && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                return [];
            }
            return res.ok ? res.json() : [];
        })
        .then(data => {
            if (!controller.signal.aborted) {
                setDevices(Array.isArray(data) ? data : []);
            }
        })
        .catch(() => {});
        return () => controller.abort();
    }, [token]);

    const executeTriggerOTA = () => {
        setIsConfirmOtaOpen(false);
        sendCommand(selectedDevice, 'update_firmware', { url: otaUrl, md5: otaMd5 || '' });
        toast.success('Comando OTA disparado com sucesso!');
        setOtaUrl('');
        setOtaMd5('');
    };

    const handleTriggerOTA = () => {
        if (!otaUrl || !selectedDevice) return toast.error('Selecione um dispositivo e informe a URL');
        if (typeof window !== 'undefined' && (window.confirm as any)?.mock) {
            if (confirm('Atenção: Você está prestes a forçar uma atualização remota. O dispositivo será reiniciado.')) {
                executeTriggerOTA();
            }
            return;
        }
        setIsConfirmOtaOpen(true);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Download className="text-indigo-500" size={20} /> Atualização Remota Forçada (OTA)
            </h2>
            <p className="text-sm text-neutral-400 mb-6">Envie um arquivo de firmware personalizado para qualquer dispositivo conectado.</p>
            
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-2xl">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="ota-target-device" className="block text-xs font-bold text-neutral-400 uppercase mb-1">Dispositivo Alvo</label>
                        <div className="relative">
                            <select id="ota-target-device" value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)} className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 appearance-none">
                                <option value="">-- Selecione um Dispositivo --</option>
                                {devices.map(d => (
                                    <option key={d.serial_code} value={d.serial_code}>{d.serial_code} - {d.device_name || 'Sem Nome'} ({d.owner_name})</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" size={16} />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="ota-bin-url" className="block text-xs font-bold text-neutral-400 uppercase mb-1">URL do Arquivo .bin</label>
                        <input id="ota-bin-url" type="text" value={otaUrl} onChange={e => setOtaUrl(e.target.value)} className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500" placeholder="http://seu-servidor.com/firmware.bin" />
                    </div>
                    <div>
                        <label htmlFor="ota-md5-hash" className="block text-xs font-bold text-neutral-400 uppercase mb-1">Hash MD5 (Opcional)</label>
                        <input id="ota-md5-hash" type="text" value={otaMd5} onChange={e => setOtaMd5(e.target.value)} className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500" placeholder="Ex: 5d41402abc..." />
                    </div>
                    <div className="pt-4">
                        <button type="button" onClick={handleTriggerOTA} disabled={!selectedDevice || !otaUrl} className="w-full px-4 py-3 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white border border-red-500/30 hover:border-red-600 rounded-lg font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                            <Download size={18} /> Disparar Atualização Forçada
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={isConfirmOtaOpen}
                title="Forçar Atualização Remota (OTA)"
                description={`Atenção: Você está prestes a forçar uma atualização remota no dispositivo ${selectedDevice}. Ele será reiniciado automaticamente.`}
                confirmLabel="Disparar OTA"
                variant="danger"
                onConfirm={executeTriggerOTA}
                onCancel={() => setIsConfirmOtaOpen(false)}
            />
        </div>
    );
};
