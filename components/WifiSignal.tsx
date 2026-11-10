import React from 'react';
import { Wifi, WifiHigh, WifiLow, WifiZero, WifiOff } from 'lucide-react';

export type WifiQuality = 'excelente' | 'bom' | 'fraco' | 'muito fraco' | 'sem dados';

/** Classifica o RSSI (dBm). Abaixo de -75 o MQTT/TLS comeca a sofrer (comandos e atualizacoes lentos). */
export const wifiQuality = (rssi?: number | null): WifiQuality => {
    if (rssi === undefined || rssi === null || !Number.isFinite(rssi) || rssi === 0) return 'sem dados';
    if (rssi >= -60) return 'excelente';
    if (rssi >= -70) return 'bom';
    if (rssi >= -80) return 'fraco';
    return 'muito fraco';
};

export const isWeakWifi = (rssi?: number | null) => {
    const q = wifiQuality(rssi);
    return q === 'fraco' || q === 'muito fraco';
};

interface WifiSignalProps {
    rssi?: number | null;
    /** Mostra o texto "Sinal fraco" ao lado quando o sinal estiver ruim */
    showWarning?: boolean;
    className?: string;
}

export const WifiSignal: React.FC<WifiSignalProps> = ({ rssi, showWarning = true, className = '' }) => {
    const q = wifiQuality(rssi);
    const Icon = q === 'excelente' ? Wifi : q === 'bom' ? WifiHigh : q === 'fraco' ? WifiLow : q === 'muito fraco' ? WifiZero : WifiOff;
    const color = q === 'excelente' || q === 'bom' ? 'text-neutral-500'
        : q === 'fraco' ? 'text-amber-500'
        : q === 'muito fraco' ? 'text-red-500'
        : 'text-neutral-700';
    const title = q === 'sem dados'
        ? 'Sinal Wi-Fi: sem dados'
        : `Sinal Wi-Fi ${q} (${rssi} dBm)${isWeakWifi(rssi) ? ' — comandos e atualizações podem ficar lentos. Aproxime o aparelho do roteador/nó da rede.' : ''}`;
    return (
        <span className={`inline-flex items-center gap-1 ${color} ${className}`} title={title} aria-label={title} data-testid="wifi-signal" data-quality={q}>
            <Icon size={14} />
            <span className="text-xs font-mono">{q === 'sem dados' ? '--' : `${rssi} dBm`}</span>
            {showWarning && isWeakWifi(rssi) && <span className="text-[10px] font-bold uppercase tracking-wide">Sinal fraco</span>}
        </span>
    );
};
