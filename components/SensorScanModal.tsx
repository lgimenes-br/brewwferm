import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Loader2, XCircle, RotateCcw, X, Save, Thermometer, Info } from 'lucide-react';
import type { ScanDetails } from '../context/BrewContext';

export type SensorRole = 's1' | 's2' | 'none';

export interface SensorMapping {
    macCtrl: string;
    mac2: string;
    name1: string;
    name2: string;
}

/**
 * Papel inicial de cada sensor encontrado: usa o mapeamento salvo na placa (macCtrl/mac2);
 * sem mapeamento, segue a ordem do barramento (1o = Sensor 1, 2o = Sensor 2), igual ao firmware.
 */
export const initialRoles = (macs: string[], macCtrl?: string, mac2?: string): Record<string, SensorRole> => {
    const ctrl = (macCtrl || '').toUpperCase();
    const second = (mac2 || '').toUpperCase();
    const roles: Record<string, SensorRole> = {};
    macs.forEach(m => { roles[m] = 'none'; });
    const ctrlFound = macs.find(m => m.toUpperCase() === ctrl && ctrl);
    const secondFound = macs.find(m => m.toUpperCase() === second && second);
    if (ctrlFound) roles[ctrlFound] = 's1';
    if (secondFound) roles[secondFound] = 's2';
    const free = macs.filter(m => roles[m] === 'none');
    if (!ctrlFound && !ctrl && free.length) roles[free.shift()!] = 's1';
    if (!secondFound && !second && free.length) roles[free.shift()!] = 's2';
    return roles;
};

export interface SensorScanModalProps {
    open: boolean;
    onClose: () => void;
    deviceId: string;
    /** scanDetails[deviceId.toUpperCase()] do BrewContext */
    scan?: ScanDetails;
    /** Mapeamento atual vindo da telemetria (fallback se a resposta do scan nao trouxer) */
    currentMacCtrl?: string;
    currentMac2?: string;
    names: { sensor1: string; sensor2: string };
    sendCommand: (serial: string, type: string, payload: any) => void;
    onSave: (mapping: SensorMapping) => Promise<void> | void;
    timeoutMs?: number;
}

type Phase = 'scanning' | 'done' | 'timeout';

const ROLE_OPTIONS: { value: SensorRole; label: string }[] = [
    { value: 's1', label: 'Sensor 1 · Controle' },
    { value: 's2', label: 'Sensor 2' },
    { value: 'none', label: 'Não usar' }
];

export const SensorScanModal: React.FC<SensorScanModalProps> = ({
    open,
    onClose,
    deviceId,
    scan,
    currentMacCtrl,
    currentMac2,
    names,
    sendCommand,
    onSave,
    timeoutMs = 15000
}) => {
    const [startedAt, setStartedAt] = useState(0);
    const [phase, setPhase] = useState<Phase>('scanning');
    const [roles, setRoles] = useState<Record<string, SensorRole>>({});
    const [name1, setName1] = useState(names.sensor1);
    const [name2, setName2] = useState(names.sensor2);
    const [saving, setSaving] = useState(false);
    const [openedAt, setOpenedAt] = useState(0);
    const rolesTouchedRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const runScan = useCallback(() => {
        if (!deviceId) return;
        setStartedAt(Date.now());
        setPhase('scanning');
        sendCommand(deviceId, 'scan_sensors', {});
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setPhase(prev => (prev === 'scanning' ? 'timeout' : prev));
        }, timeoutMs);
    }, [deviceId, sendCommand, timeoutMs]);

    // Ao abrir: reseta edicao e dispara o scan
    useEffect(() => {
        if (open) {
            rolesTouchedRef.current = false;
            setOpenedAt(Date.now());
            setRoles({});
            setName1(names.sensor1);
            setName2(names.sensor2);
            runScan();
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, runScan]);

    // Resposta nova do scan chegou
    const receivedAt = scan?.receivedAt;
    useEffect(() => {
        if (!open || !scan || !startedAt || !receivedAt || receivedAt < startedAt) return;
        setPhase('done');
        if (timerRef.current) clearTimeout(timerRef.current);
        const macs = scan.sensors.map(s => s.mac);
        setRoles(prev => {
            // Re-scan (ex: para identificar um sensor aquecendo na mao) nao apaga o que o usuario escolheu
            if (rolesTouchedRef.current) {
                const next: Record<string, SensorRole> = {};
                macs.forEach(m => { next[m] = prev[m] ?? 'none'; });
                return next;
            }
            return initialRoles(macs, scan.macCtrl ?? currentMacCtrl, scan.mac2 ?? currentMac2);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [receivedAt, startedAt, open]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    // Mostra o ultimo resultado recebido desde que o modal abriu (inclusive durante um re-scan)
    const sensors = scan && openedAt && scan.receivedAt >= openedAt && phase !== 'timeout' ? scan.sensors : [];

    const setRole = (mac: string, role: SensorRole) => {
        rolesTouchedRef.current = true;
        setRoles(prev => {
            const next = { ...prev };
            const previousRole = next[mac] ?? 'none';
            // Sensor 1 e Sensor 2 sao exclusivos: quem tinha esse papel troca com este sensor
            if (role !== 'none') {
                Object.keys(next).forEach(m => { if (m !== mac && next[m] === role) next[m] = previousRole; });
            }
            next[mac] = role;
            return next;
        });
    };

    const macFor = (role: SensorRole) => Object.keys(roles).find(m => roles[m] === role) || '';
    const hasS1 = !!macFor('s1');

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave({
                macCtrl: macFor('s1'),
                mac2: macFor('s2'),
                name1: name1.trim() || 'Fermentador',
                name2: name2.trim() || 'Geladeira'
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sensor-scan-title"
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/5 text-white rounded-full flex items-center justify-center">
                            <Search size={20} />
                        </div>
                        <div>
                            <h3 id="sensor-scan-title" className="text-lg font-medium text-white">Escanear Sensores</h3>
                            <p className="text-neutral-500 text-xs">{deviceId}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar" className="text-neutral-500 hover:text-white p-1">
                        <X size={18} />
                    </button>
                </div>

                {phase === 'scanning' && (
                    <div className="flex items-center gap-3 text-neutral-300 text-sm bg-neutral-800/50 rounded-xl p-4 mb-4">
                        <Loader2 size={16} className="animate-spin" /> Procurando sensores DS18B20 no barramento 1-Wire...
                    </div>
                )}
                {phase === 'timeout' && (
                    <div className="flex items-start gap-3 text-red-300 text-sm bg-red-950/40 border border-red-900/50 rounded-xl p-4 mb-4">
                        <XCircle size={16} className="mt-0.5 shrink-0" />
                        <div>
                            <p className="font-medium">Sem resposta do aparelho</p>
                            <p className="text-red-300/70 text-xs">Nenhuma resposta em {Math.round(timeoutMs / 1000)}s. Verifique se o aparelho está ligado, conectado ao Wi-Fi e com o firmware atualizado.</p>
                        </div>
                    </div>
                )}
                {phase === 'done' && sensors.length === 0 && (
                    <div className="flex items-start gap-3 text-amber-300 text-sm bg-amber-950/30 border border-amber-900/50 rounded-xl p-4 mb-4">
                        <XCircle size={16} className="mt-0.5 shrink-0" />
                        <div>
                            <p className="font-medium">Nenhum sensor encontrado</p>
                            <p className="text-amber-300/70 text-xs">Confira o conector JST (sinal no GPIO17), alimentação, GND e o resistor de pull-up de 4.7kΩ.</p>
                        </div>
                    </div>
                )}

                {sensors.length > 0 && (
                    <>
                        <p className="text-neutral-400 text-xs mb-3">
                            {sensors.length} {sensors.length === 1 ? 'sensor encontrado' : 'sensores encontrados'}. O <span className="text-white">Sensor 1</span> controla aquecimento e resfriamento.
                        </p>
                        <div className="space-y-2 mb-3">
                            {sensors.map(s => {
                                const role = roles[s.mac] ?? 'none';
                                return (
                                    <div key={s.mac} data-testid={`scan-row-${s.mac}`} className="bg-neutral-800/40 border border-neutral-800 rounded-xl p-3">
                                        <div className="flex items-center justify-between gap-3 mb-2">
                                            <div className="min-w-0 flex items-center gap-2">
                                                <Thermometer size={14} className="text-neutral-500 shrink-0" />
                                                <span className="font-mono text-[11px] text-neutral-400 truncate">{s.mac}</span>
                                            </div>
                                            <span className="text-white font-mono text-sm shrink-0">
                                                {s.temp !== null ? `${s.temp.toFixed(2)} °C` : '--'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-lg" role="radiogroup" aria-label={`Função do sensor ${s.mac}`}>
                                            {ROLE_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={role === opt.value}
                                                    onClick={() => setRole(s.mac, opt.value)}
                                                    className={`py-1.5 rounded-md text-[11px] font-bold transition-colors ${role === opt.value ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                        {role !== 'none' && (
                                            <input
                                                type="text"
                                                aria-label={role === 's1' ? 'Nome do Sensor 1' : 'Nome do Sensor 2'}
                                                placeholder={role === 's1' ? 'Nome (ex: Fermentador)' : 'Nome (ex: Geladeira)'}
                                                maxLength={30}
                                                value={role === 's1' ? name1 : name2}
                                                onChange={(e) => (role === 's1' ? setName1 : setName2)(e.target.value)}
                                                className="mt-2 w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-sm text-white focus:border-white focus:outline-none"
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <p className="flex items-start gap-2 text-neutral-500 text-[11px] mb-4">
                            <Info size={12} className="mt-0.5 shrink-0" />
                            Não sabe qual é qual? Segure um sensor na mão por alguns segundos e clique em "Escanear novamente": o que esquentar é ele.
                        </p>
                        {!hasS1 && (
                            <p className="text-amber-300/80 text-xs mb-4">Escolha um sensor como Sensor 1 para o controle de temperatura funcionar.</p>
                        )}
                    </>
                )}

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={runScan}
                        disabled={phase === 'scanning'}
                        className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                        <RotateCcw size={16} /> Escanear novamente
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!hasS1 || saving || phase !== 'done'}
                        className="flex-1 bg-white text-black hover:bg-neutral-200 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar
                    </button>
                </div>
            </div>
        </div>
    );
};
