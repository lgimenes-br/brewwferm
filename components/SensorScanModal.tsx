import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Loader2, XCircle, RotateCcw, X, Save, Thermometer, Info } from 'lucide-react';
import type { ScanDetails } from '../context/BrewContext';

// Sensores numerados (fw 2.11+): ate 4 DS18B20, Sensor 1..4, cada um preso ao MAC. Nomes livres e,
// separado, qual sensor CONTROLA cada modo (so um por modo; os outros aparecem so para ver).
// Mesma regra do app (breww-app/src/core/sensors.ts). Manter igual.

export type SensorRole = 's1' | 's2' | 's3' | 's4' | 'none';
export const SLOT_ROLES: SensorRole[] = ['s1', 's2', 's3', 's4'];

export interface SensorMapping {
    /** MAC de cada Sensor 1..4 ('' = livre) */
    macs: string[];
    /** Nome de cada Sensor 1..4 */
    names: string[];
    /** Sensor que controla cada modo [fermentador, geladeira, choppeira]; -1 = automatico. Ausente = nao mudou */
    control?: number[];
    // Formato antigo (firmware anterior a 2.11 so entende o Sensor 1 e o 2)
    macCtrl: string;
    mac2: string;
    name1: string;
    name2: string;
}

/**
 * Numero inicial de cada sensor encontrado: usa o que esta salvo na placa (slots no fw 2.11+, ou
 * macCtrl/mac2 antes); sem nada salvo, segue a ordem do barramento, igual ao firmware. Um numero salvo
 * cujo sensor sumiu do barramento fica vazio (nao promove outro sensor sem o usuario decidir).
 */
export const initialRoles = (macs: string[], macCtrl?: string, mac2?: string, slots?: string[]): Record<string, SensorRole> => {
    const saved = (slots && slots.length ? slots : [macCtrl || '', mac2 || '']).concat(['', '', '', '']).slice(0, 4).map(m => (m || '').toUpperCase());
    const roles: Record<string, SensorRole> = {};
    macs.forEach(m => { roles[m] = 'none'; });
    saved.forEach((mac, i) => {
        const found = mac && macs.find(m => m.toUpperCase() === mac);
        if (found) roles[found] = SLOT_ROLES[i];
    });
    const free = macs.filter(m => roles[m] === 'none');
    saved.forEach((mac, i) => { if (!mac && free.length) roles[free.shift()!] = SLOT_ROLES[i]; });
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
    names: { sensor1: string; sensor2: string; sensor3?: string; sensor4?: string };
    /** MAC salvo em cada Sensor 1..4 (fw 2.11+, telemetria/scan) */
    currentSlots?: string[];
    /** Escolha atual por modo (fw 2.11+); ausente = firmware antigo, sem escolha */
    currentControl?: number[];
    sendCommand: (serial: string, type: string, payload: any) => void;
    onSave: (mapping: SensorMapping) => Promise<void> | void;
    timeoutMs?: number;
}

type Phase = 'scanning' | 'done' | 'timeout';

const ROLE_OPTIONS: { value: SensorRole; label: string }[] = [
    { value: 's1', label: '1' },
    { value: 's2', label: '2' },
    { value: 's3', label: '3' },
    { value: 's4', label: '4' },
    { value: 'none', label: 'Não usar' }
];
const MODES = ['Fermentador', 'Geladeira', 'Choppeira'];
const CONTROL_VALUES = [-1, 0, 1, 2, 3];
const cleanName = (n: string | undefined, i: number) => (n && n !== `Sensor ${i + 1}` ? n : '');

export const SensorScanModal: React.FC<SensorScanModalProps> = ({
    open,
    onClose,
    deviceId,
    scan,
    currentMacCtrl,
    currentMac2,
    names,
    currentSlots,
    currentControl,
    sendCommand,
    onSave,
    timeoutMs = 15000
}) => {
    const [startedAt, setStartedAt] = useState(0);
    const [phase, setPhase] = useState<Phase>('scanning');
    const [roles, setRoles] = useState<Record<string, SensorRole>>({});
    const initialNames = () => [names.sensor1, names.sensor2, names.sensor3, names.sensor4].map(cleanName);
    const [slotNames, setSlotNames] = useState<string[]>(initialNames);
    const [control, setControl] = useState<number[] | null>(null);
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
            setSlotNames(initialNames());
            setControl(null);
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
            return initialRoles(macs, scan.macCtrl ?? currentMacCtrl, scan.mac2 ?? currentMac2, (scan as any).slots ?? currentSlots);
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
            // Cada numero e de um sensor so: quem tinha esse numero troca com este sensor
            if (role !== 'none') {
                Object.keys(next).forEach(m => { if (m !== mac && next[m] === role) next[m] = previousRole; });
            }
            next[mac] = role;
            return next;
        });
    };

    const macFor = (role: SensorRole) => Object.keys(roles).find(m => roles[m] === role) || '';
    const hasAny = SLOT_ROLES.some(r => !!macFor(r));
    const shownControl = control ?? currentControl ?? [-1, -1, -1];

    const handleSave = async () => {
        setSaving(true);
        try {
            const macs = SLOT_ROLES.map(macFor);
            const finalNames = slotNames.map((n, i) => n.trim() || `Sensor ${i + 1}`);
            await onSave({
                macs,
                names: finalNames,
                control: currentControl && control ? control : undefined,
                macCtrl: macs[0],
                mac2: macs[1],
                name1: finalNames[0],
                name2: finalNames[1]
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
            className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0B0D12]/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white border border-black/[0.07] p-6 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-black/[0.04] text-[var(--ink)] rounded-full flex items-center justify-center">
                            <Search size={20} />
                        </div>
                        <div>
                            <h3 id="sensor-scan-title" className="text-lg font-medium text-[var(--ink)]">Escanear Sensores</h3>
                            <p className="text-[var(--muted)] text-xs">{deviceId}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar" className="text-[var(--muted)] hover:text-[var(--ink)] p-1">
                        <X size={18} />
                    </button>
                </div>

                {phase === 'scanning' && (
                    <div className="flex items-center gap-3 text-[#2b2f37] text-sm bg-[var(--bg)] rounded-xl p-4 mb-4">
                        <Loader2 size={16} className="animate-spin" /> Procurando sensores DS18B20 no barramento 1-Wire...
                    </div>
                )}
                {phase === 'timeout' && (
                    <div className="flex items-start gap-3 text-[#d63a4d] text-sm bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                        <XCircle size={16} className="mt-0.5 shrink-0" />
                        <div>
                            <p className="font-medium">Sem resposta do aparelho</p>
                            <p className="text-[#d63a4d]/80 text-xs">Nenhuma resposta em {Math.round(timeoutMs / 1000)}s. Verifique se o aparelho está ligado, conectado ao Wi-Fi e com o firmware atualizado.</p>
                        </div>
                    </div>
                )}
                {phase === 'done' && sensors.length === 0 && (
                    <div className="flex items-start gap-3 text-[#b45309] text-sm bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4">
                        <XCircle size={16} className="mt-0.5 shrink-0" />
                        <div>
                            <p className="font-medium">Nenhum sensor encontrado</p>
                            <p className="text-amber-700 text-xs">Confira o conector JST (sinal no GPIO17), alimentação, GND e o resistor de pull-up de 4.7kΩ.</p>
                        </div>
                    </div>
                )}

                {sensors.length > 0 && (
                    <>
                        <p className="text-[var(--muted)] text-xs mb-3">
                            {sensors.length} {sensors.length === 1 ? 'sensor encontrado' : 'sensores encontrados'}. Dê um número a cada um (até 4); quem controla cada modo você escolhe abaixo.
                        </p>
                        <div className="space-y-2 mb-3">
                            {sensors.map(s => {
                                const role = roles[s.mac] ?? 'none';
                                return (
                                    <div key={s.mac} data-testid={`scan-row-${s.mac}`} className="bg-[var(--bg)] border border-black/[0.07] rounded-xl p-3">
                                        <div className="flex items-center justify-between gap-3 mb-2">
                                            <div className="min-w-0 flex items-center gap-2">
                                                <Thermometer size={14} className="text-[var(--muted)] shrink-0" />
                                                <span className="font-mono text-[11px] text-[var(--muted)] truncate">{s.mac}</span>
                                            </div>
                                            <span className="text-[var(--ink)] font-mono text-sm shrink-0">
                                                {s.temp !== null ? `${s.temp.toFixed(2)} °C` : '--'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_1.8fr] gap-1 bg-[var(--bg)] p-1 rounded-full" role="radiogroup" aria-label={`Função do sensor ${s.mac}`}>
                                            {ROLE_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={role === opt.value}
                                                    onClick={() => setRole(s.mac, opt.value)}
                                                    className={`py-1.5 rounded-full text-[13px] transition-colors ${role === opt.value ? 'bg-[var(--fill)] text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="flex items-start gap-2 text-[var(--muted)] text-[11px] mb-4">
                            <Info size={12} className="mt-0.5 shrink-0" />
                            Não sabe qual é qual? Segure um sensor na mão por alguns segundos e clique em "Escanear novamente": o que esquentar é ele.
                        </p>
                        <div className="mb-4">
                            <p className="text-[13px] text-[var(--muted)] mb-2">Nomes (opcional)</p>
                            <div className="grid grid-cols-2 gap-2">
                                {SLOT_ROLES.map((r, i) => (
                                    <input key={r} type="text" aria-label={`Nome do Sensor ${i + 1}`} maxLength={30}
                                        placeholder={`Sensor ${i + 1} (ex.: ${['Cerveja', 'Geladeira', 'Ambiente', 'Barril'][i]})`}
                                        value={slotNames[i]} onChange={e => setSlotNames(n => n.map((x, k) => (k === i ? e.target.value : x)))}
                                        className="w-full h-10 rounded-full border border-[var(--line)] bg-[var(--cell-2)] px-4 text-sm text-[var(--ink)] placeholder:text-[var(--tertiary)] focus:outline-none focus:border-[rgba(113,252,143,0.55)]" />
                                ))}
                            </div>
                        </div>
                        {currentControl ? (
                            <div className="mb-4">
                                <p className="text-[13px] text-[var(--muted)] mb-2">Quem controla a temperatura</p>
                                <div className="space-y-2">
                                    {MODES.map((label, m) => (
                                        <div key={label} className="flex items-center gap-3">
                                            <span className="w-24 shrink-0 text-sm text-[var(--ink)]">{label}</span>
                                            <div className="grid flex-1 grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] gap-1 rounded-full bg-[var(--bg)] p-1" role="radiogroup" aria-label={`Sensor que controla o modo ${label}`}>
                                                {CONTROL_VALUES.map(v => (
                                                    <button key={v} type="button" role="radio" aria-checked={(shownControl[m] ?? -1) === v}
                                                        onClick={() => setControl(shownControl.map((x, k) => (k === m ? v : x)))}
                                                        className={`py-1.5 rounded-full text-[13px] transition-colors ${(shownControl[m] ?? -1) === v ? 'bg-[var(--fill)] text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
                                                        {v < 0 ? 'Auto' : v + 1}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-2 text-[12px] text-[var(--tertiary)]">Só um sensor controla cada modo; os outros aparecem só para ver. Automático: fermentador pelo Sensor 1, geladeira e choppeira pelo Sensor 2.</p>
                            </div>
                        ) : (
                            <p className="text-[12px] text-[var(--muted)] mb-4">Para escolher qual sensor controla cada modo, atualize o firmware do aparelho para a versão 2.11 ou mais nova.</p>
                        )}
                        {!hasAny && (
                            <p className="text-[var(--danger)] text-xs mb-4">Dê um número a pelo menos um sensor para o controle de temperatura funcionar.</p>
                        )}
                    </>
                )}

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={runScan}
                        disabled={phase === 'scanning'}
                        className="flex-1 bg-[var(--bg)] hover:bg-black/10 text-[var(--ink)] py-3 rounded-xl font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                        <RotateCcw size={16} /> Escanear novamente
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!hasAny || saving || phase !== 'done'}
                        className="flex-1 bg-[var(--ink)] text-white hover:bg-black py-3 rounded-xl font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar
                    </button>
                </div>
            </div>
        </div>
    );
};
