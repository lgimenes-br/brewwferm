import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle, Loader2, RotateCcw, X, Copy } from 'lucide-react';

export type SensorKind = 'temperature' | 'humidity' | 'gravity' | 'battery' | 'generic';
export type SensorStatus = 'ok' | 'suspect' | 'missing';

export interface SensorClassification {
    status: SensorStatus;
    value?: number;
    hint?: string;
}

const RANGES: Record<SensorKind, [number, number] | null> = {
    temperature: [-20, 60],
    humidity: [1, 100],
    gravity: [0.99, 1.2],
    battery: [2.5, 4.5],
    generic: null
};

/** Classifica uma leitura bruta de sensor. Função pura (testável). */
export const classifySensor = (kind: SensorKind, raw: unknown): SensorClassification => {
    if (raw === null) {
        return {
            status: 'suspect',
            hint: kind === 'humidity'
                ? 'O aparelho reportou que o sensor não está respondendo (sem leitura válida nos últimos 10s). Verifique fiação do DATA, alimentação, GND e pull-up de 10kΩ.'
                : 'O aparelho reportou que o sensor não tem leitura válida.'
        };
    }
    if (raw === undefined || raw === '') {
        return { status: 'missing', hint: 'O campo não veio na telemetria do aparelho.' };
    }
    const value = typeof raw === 'number' ? raw : parseFloat(String(raw));
    if (isNaN(value)) {
        return { status: 'suspect', hint: `Valor não numérico recebido: "${String(raw)}".` };
    }
    if (kind === 'temperature') {
        if (value === -127) return { status: 'suspect', value, hint: 'DS18B20 desconectado (-127): verifique cabo, pino DATA e resistor de pull-up de 4.7kΩ.' };
        if (value === 85) return { status: 'suspect', value, hint: 'DS18B20 retornou 85 (valor de power-on): leitura antes da conversão ou alimentação instável.' };
    }
    if (value === 0 && kind !== 'generic') {
        const hint = kind === 'humidity'
            ? 'Umidade 0: o sensor provavelmente não inicializou. Verifique fiação/pino DATA, alimentação (3.3V) e se o tipo de sensor (DHT/AHT/SHT) está certo no firmware.'
            : 'Valor exatamente 0: costuma indicar sensor não lido ou não inicializado.';
        return { status: 'suspect', value, hint };
    }
    const range = RANGES[kind];
    if (range && (value < range[0] || value > range[1])) {
        return { status: 'suspect', value, hint: `Fora da faixa esperada (${range[0]} a ${range[1]}).` };
    }
    return { status: 'ok', value };
};

const guessKind = (key: string): SensorKind => {
    const k = key.toLowerCase();
    if (k.includes('hum') || k === 'rh') return 'humidity';
    if (k.includes('temp') || /^t\d*$/.test(k) || k.startsWith('ds')) return 'temperature';
    return 'generic';
};

interface SensorRow {
    key: string;
    label: string;
    kind: SensorKind;
    raw: unknown;
    unit: string;
}

export interface SensorTestModalProps {
    open: boolean;
    onClose: () => void;
    deviceId: string;
    /** fermenter.currentDevice (inclui rawPayload e lastPacketMs) */
    device?: any;
    names: { sensor1: string; sensor2: string; sg: string };
    sendCommand: (serial: string, type: string, payload: any) => void;
    timeoutMs?: number;
}

type Phase = 'waiting' | 'received' | 'timeout';

export const SensorTestModal: React.FC<SensorTestModalProps> = ({
    open,
    onClose,
    deviceId,
    device,
    names,
    sendCommand,
    timeoutMs = 15000
}) => {
    const [startedAt, setStartedAt] = useState(0);
    const [phase, setPhase] = useState<Phase>('waiting');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const runTest = useCallback(() => {
        if (!deviceId) return;
        setStartedAt(Date.now());
        setPhase('waiting');
        sendCommand(deviceId, 'request_status', {});
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setPhase(prev => (prev === 'waiting' ? 'timeout' : prev));
        }, timeoutMs);
    }, [deviceId, sendCommand, timeoutMs]);

    useEffect(() => {
        if (open) runTest();
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [open, runTest]);

    const lastPacketMs: number | undefined = device?.lastPacketMs;
    useEffect(() => {
        if (phase === 'waiting' && startedAt && lastPacketMs && lastPacketMs >= startedAt) {
            setPhase('received');
            if (timerRef.current) clearTimeout(timerRef.current);
        }
    }, [lastPacketMs, startedAt, phase]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    const raw: Record<string, any> = device?.rawPayload || {};

    const rows: SensorRow[] = useMemo(() => {
        const list: SensorRow[] = [
            { key: 'ferm', label: names.sensor1, kind: 'temperature', raw: raw.ferm, unit: '°C' },
            { key: 'amb', label: names.sensor2, kind: 'temperature', raw: raw.amb, unit: '°C' }
        ];
        const ext = raw.ext_s ?? raw.extSens;
        if (ext && typeof ext === 'object') {
            Object.entries(ext).forEach(([k, v]) => {
                const kind = guessKind(k);
                list.push({ key: `ext.${k}`, label: kind === 'humidity' ? `Umidade (${k})` : `Extra: ${k}`, kind, raw: v, unit: kind === 'humidity' ? '%' : kind === 'temperature' ? '°C' : '' });
            });
        } else {
            list.push({ key: 'hum', label: 'Umidade', kind: 'humidity', raw: raw.hum ?? ext, unit: '%' });
        }
        if (raw.is_sg !== undefined || raw.is_bat !== undefined) {
            list.push({ key: 'is_sg', label: names.sg, kind: 'gravity', raw: raw.is_sg, unit: 'SG' });
            list.push({ key: 'is_bat', label: `${names.sg} (bateria)`, kind: 'battery', raw: raw.is_bat, unit: 'V' });
        }
        return list;
    }, [raw, names.sensor1, names.sensor2, names.sg]);

    if (!open) return null;

    const hasData = phase === 'received' || (phase === 'timeout' && Object.keys(raw).length > 0);
    const rawJson = JSON.stringify(raw, null, 2);

    const copyPayload = () => {
        try {
            navigator.clipboard?.writeText(rawJson);
        } catch (e) { /* ignore */ }
    };

    const StatusBadge: React.FC<{ status: SensorStatus }> = ({ status }) => {
        if (status === 'ok') return <span className="inline-flex items-center gap-1 text-[#178a3f] text-xs font-bold "><CheckCircle2 size={14} /> OK</span>;
        if (status === 'suspect') return <span className="inline-flex items-center gap-1 text-[#b45309] text-xs font-bold "><AlertTriangle size={14} /> Suspeito</span>;
        return <span className="inline-flex items-center gap-1 text-[var(--muted)] text-xs font-bold "><XCircle size={14} /> Ausente</span>;
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sensor-test-title"
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
                            <Activity size={20} />
                        </div>
                        <div>
                            <h3 id="sensor-test-title" className="text-lg font-medium text-[var(--ink)]">Teste de Sensores</h3>
                            <p className="text-[var(--muted)] text-xs">{deviceId}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar" className="text-[var(--muted)] hover:text-[var(--ink)] p-1">
                        <X size={18} />
                    </button>
                </div>

                {phase === 'waiting' && (
                    <div className="flex items-center gap-3 text-[#2b2f37] text-sm bg-[var(--bg)] rounded-xl p-4 mb-4">
                        <Loader2 size={16} className="animate-spin" /> Solicitando leitura ao aparelho...
                    </div>
                )}
                {phase === 'timeout' && (
                    <div className="flex items-start gap-3 text-[#d63a4d] text-sm bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                        <XCircle size={16} className="mt-0.5 shrink-0" />
                        <div>
                            <p className="font-medium">Sem resposta do aparelho</p>
                            <p className="text-[#d63a4d]/80 text-xs">Nenhum pacote novo em {Math.round(timeoutMs / 1000)}s. Verifique se o aparelho está ligado e conectado ao Wi-Fi.{Object.keys(raw).length > 0 ? ' Abaixo, a última leitura conhecida.' : ''}</p>
                        </div>
                    </div>
                )}

                {hasData && (
                    <div className="space-y-2 mb-4">
                        {rows.map(row => {
                            const c = classifySensor(row.kind, row.raw);
                            return (
                                <div key={row.key} data-testid={`sensor-row-${row.key}`} data-status={c.status} className="bg-[var(--bg)] border border-black/[0.07] rounded-xl p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[var(--ink)] text-sm font-medium truncate">{row.label}</p>
                                            <p className="text-[var(--muted)] text-[11px] font-mono">bruto: {row.raw === undefined ? '—' : JSON.stringify(row.raw)}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[var(--ink)] font-mono text-sm">{c.value !== undefined ? `${c.value}${row.unit ? ' ' + row.unit : ''}` : '--'}</p>
                                            <StatusBadge status={c.status} />
                                        </div>
                                    </div>
                                    {c.hint && c.status !== 'ok' && (
                                        <p className={`text-xs mt-2 ${c.status === 'suspect' ? 'text-[#b45309]' : 'text-[var(--muted)]'}`}>{c.hint}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {hasData && (
                    <div className="text-[11px] text-[var(--muted)] grid grid-cols-2 gap-2 mb-4">
                        <span>RSSI: {raw.rssi ?? '--'} dBm</span>
                        <span>Firmware: {raw.ver || raw.fw || '--'}</span>
                        <span className="col-span-2">Último pacote: {lastPacketMs ? new Date(lastPacketMs).toLocaleTimeString() : '--'}</span>
                    </div>
                )}

                {Object.keys(raw).length > 0 && (
                    <details className="mb-4">
                        <summary className="text-xs text-[var(--muted)] cursor-pointer select-none">Payload bruto (JSON)</summary>
                        <div className="relative mt-2">
                            <button type="button" onClick={copyPayload} className="absolute top-2 right-2 text-[var(--muted)] hover:text-[var(--ink)]" aria-label="Copiar payload">
                                <Copy size={14} />
                            </button>
                            <pre className="bg-[var(--bg)] text-[#2b2f37] text-[11px] p-3 rounded-lg overflow-x-auto max-h-60">{rawJson}</pre>
                        </div>
                    </details>
                )}

                <div className="flex gap-3">
                    <button type="button" onClick={onClose} className="flex-1 bg-[var(--bg)] hover:bg-black/10 text-[var(--ink)] py-3 rounded-xl font-medium transition-colors">
                        Fechar
                    </button>
                    <button
                        type="button"
                        onClick={runTest}
                        disabled={phase === 'waiting'}
                        className="flex-1 bg-[var(--ink)] text-white hover:bg-black py-3 rounded-xl font-bold transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                        <RotateCcw size={16} /> Testar novamente
                    </button>
                </div>
            </div>
        </div>
    );
};
