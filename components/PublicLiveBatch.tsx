import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicBatch } from '../services/api';
import { Reading, FermentationEvent, EventType, normalizeGravity } from '../types';
import { TemperatureChart } from './TemperatureChart';
import { GravityChart } from './GravityChart';
import { Eye, RefreshCw, Snowflake, Target, Battery, ArrowDown, Percent, FlaskConical, Clock, CheckCircle2 } from 'lucide-react';

export const PublicLiveBatch: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [data, setData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const loadBatch = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetchPublicBatch(token);
            setData(res);
            setError(null);
            setLastRefresh(new Date());
        } catch (err: any) {
            setError(err?.message || 'Lote público não encontrado ou link revogado.');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadBatch();
        const interval = setInterval(() => {
            if (typeof document === 'undefined' || !document.hidden) {
                loadBatch();
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [loadBatch]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center p-8">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="animate-spin text-[#b45309]" size={28} />
                    <p className="text-[var(--muted)] text-sm font-mono ">Carregando Transmissão Ao Vivo...</p>
                </div>
            </div>
        );
    }

    if (error || !data?.batch) {
        return (
            <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center p-8">
                <div className="bg-white border border-black/[0.07] rounded-3xl p-8 max-w-md text-center space-y-3">
                    <h2 className="text-2xl font-semibold text-[var(--ink)]">Link Indisponível</h2>
                    <p className="text-[var(--muted)] text-sm">{error || 'Este lote não está mais público.'}</p>
                </div>
            </div>
        );
    }

    const { batch, telemetry = [], events = [] } = data;
    const isActive = Boolean(batch.is_active);
    const readings: Reading[] = telemetry.map((l: any) => ({
        timestamp: l.recorded_at,
        beerTemp: l.temp_ferm !== null && l.temp_ferm !== undefined ? parseFloat(String(l.temp_ferm)) : (NaN as any),
        fridgeTemp: l.temp_amb !== null && l.temp_amb !== undefined ? parseFloat(String(l.temp_amb)) : (NaN as any),
        targetTemp: l.target_temp !== null && l.target_temp !== undefined ? parseFloat(String(l.target_temp)) : (NaN as any),
        gravity: l.gravity !== null && l.gravity !== undefined ? normalizeGravity(l.gravity, 0) : 0
    }));

    const mappedEvents: FermentationEvent[] = events.map((e: any) => ({
        id: String(e.id),
        type: (e.event_type as EventType) || EventType.OTHER,
        description: e.description || '',
        timestamp: e.recorded_at
    }));

    const latest = telemetry.length > 0 ? telemetry[telemetry.length - 1] : null;
    const currentTemp = latest?.temp_ferm != null ? parseFloat(String(latest.temp_ferm)) : 0;
    const currentFridge = latest?.temp_amb != null ? parseFloat(String(latest.temp_amb)) : 0;
    const currentTarget = latest?.target_temp != null ? parseFloat(String(latest.target_temp)) : 0;
    const currentBattery = latest?.battery != null ? parseFloat(String(latest.battery)) : 0;
    const currentGravity = latest?.gravity != null ? normalizeGravity(latest.gravity, 0) : 0;
    const safeOG = normalizeGravity(batch.og, 0);
    const safeFG = normalizeGravity(batch.fg, 0);

    const abv = (safeOG > 1.0 && currentGravity > 0.9 && safeOG > currentGravity)
        ? Math.max(0, (safeOG - currentGravity) * 131.25).toFixed(1)
        : '0.0';

    const attenuation = (safeOG > 1.0 && currentGravity > 0.9 && safeOG > currentGravity)
        ? Math.max(0, ((safeOG - currentGravity) / (safeOG - 1.0)) * 100).toFixed(0)
        : '0';

    let profileSteps: any[] = [];
    if (batch.profile) {
        try {
            profileSteps = typeof batch.profile === 'string' ? JSON.parse(batch.profile) : batch.profile;
        } catch (e) {}
    }
    const curStepIdx = Number(batch.current_step_index) || 0;

    return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] pb-20">
            {/* Public Spectator Top Bar */}
            <header className="border-b border-black/[0.07] bg-white/80 backdrop-blur-md sticky top-0 z-30 px-6 md:px-10 py-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-baseline select-none">
                        <span className="text-3xl font-semibold text-[var(--ink)] tracking-tighter">BREW</span>
                        <div className="relative">
                            <span className="text-3xl font-semibold text-[var(--ink)] tracking-tighter">W</span>
                            <div className="absolute top-0 -right-2 w-2.5 h-1.5 bg-white rounded-tr-sm"></div>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-bold ${
                        isActive ? 'bg-[var(--accent)]/25 border-emerald-500/40 text-[#178a3f]' : 'bg-[var(--bg)] border-black/15 text-[#2b2f37]'
                    }`}>
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-black/30'}`}></span>
                        <Eye size={13} />
                        {isActive ? 'Ao Vivo • Modo Espectador' : 'Lote Finalizado • Somente Leitura'}
                    </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                    <span className="font-mono hidden sm:inline">Atualizado às {lastRefresh.toLocaleTimeString()}</span>
                    <button
                        type="button"
                        onClick={loadBatch}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[var(--bg)] border border-black/[0.07] text-[#2b2f37] rounded-lg font-bold text-[11px] transition-colors"
                    >
                        <RefreshCw size={12} /> Atualizar
                    </button>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 md:px-10 pt-8 space-y-8">
                {/* Batch Hero */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-mono text-[var(--muted)] mb-2">
                            <span>Lote #{batch.id}</span>
                            <span>•</span>
                            <span>{batch.device_name || 'Controlador Breww'}</span>
                        </div>
                        <h1 className="text-5xl md:text-6xl font-semibold text-[var(--ink)] tracking-tighter">{batch.name || 'Fermentação Ao Vivo'}</h1>
                        {batch.style && (
                            <span className="inline-block mt-2 px-3 py-1 bg-white border border-black/[0.07] rounded-lg text-xs text-[#2b2f37] font-bold">
                                {batch.style}
                            </span>
                        )}
                    </div>
                </div>

                {/* Live Telemetry Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                    <div className="bg-white border border-black/[0.07] rounded-2xl p-4">
                        <span className="text-[10px] font-bold text-[var(--muted)] block mb-1">{batch.sensor1_name || 'Mosto'}</span>
                        <span className="text-2xl font-mono font-bold text-[var(--ink)]">{currentTemp.toFixed(1)}°C</span>
                    </div>
                    <div className="bg-white border border-black/[0.07] rounded-2xl p-4">
                        <span className="text-[10px] font-bold text-[var(--muted)] flex items-center gap-1 mb-1"><Target size={11} /> Set-Point</span>
                        <span className="text-2xl font-mono font-bold text-[#b45309]">{currentTarget.toFixed(1)}°C</span>
                    </div>
                    <div className="bg-white border border-black/[0.07] rounded-2xl p-4">
                        <span className="text-[10px] font-bold text-[var(--muted)] flex items-center gap-1 mb-1"><Snowflake size={11} /> {batch.sensor2_name || 'Geladeira'}</span>
                        <span className="text-2xl font-mono font-bold text-blue-600">{currentFridge.toFixed(1)}°C</span>
                    </div>
                    <div className="bg-white border border-black/[0.07] rounded-2xl p-4">
                        <span className="text-[10px] font-bold text-[var(--muted)] block mb-1">{batch.sensor_sg_name || 'Densidade'}</span>
                        <span className="text-2xl font-mono font-bold text-[#178a3f]">{currentGravity > 0 ? currentGravity.toFixed(3) : '--'}</span>
                    </div>
                    <div className="bg-white border border-black/[0.07] rounded-2xl p-4">
                        <span className="text-[10px] font-bold text-[var(--muted)] flex items-center gap-1 mb-1"><ArrowDown size={11} /> OG / FG</span>
                        <span className="text-sm font-mono font-bold text-[var(--ink)]">{safeOG > 0 ? safeOG.toFixed(3) : '--'} → {safeFG > 0 ? safeFG.toFixed(3) : '--'}</span>
                    </div>
                    <div className="bg-white border border-black/[0.07] rounded-2xl p-4">
                        <span className="text-[10px] font-bold text-[var(--muted)] flex items-center gap-1 mb-1"><FlaskConical size={11} /> ABV Est.</span>
                        <span className="text-2xl font-mono font-bold text-[#178a3f]">{abv}%</span>
                    </div>
                    <div className="bg-white border border-black/[0.07] rounded-2xl p-4">
                        <span className="text-[10px] font-bold text-[var(--muted)] flex items-center gap-1 mb-1"><Percent size={11} /> Atenuação</span>
                        <span className="text-2xl font-mono font-bold text-[var(--ink)]">{attenuation}%</span>
                    </div>
                    <div className="bg-white border border-black/[0.07] rounded-2xl p-4">
                        <span className="text-[10px] font-bold text-[var(--muted)] flex items-center gap-1 mb-1"><Battery size={11} /> Bateria</span>
                        <span className="text-2xl font-mono font-bold text-[#2b2f37]">{currentBattery > 0 ? `${currentBattery.toFixed(2)}V` : '--'}</span>
                    </div>
                </div>

                {/* Read-Only Ramp Profile Progress */}
                {Array.isArray(profileSteps) && profileSteps.length > 0 && (
                    <div className="bg-white border border-black/[0.07] rounded-3xl p-6">
                        <h3 className="text-xs font-bold text-[var(--muted)] mb-4 flex items-center gap-2">
                            <Clock size={14} /> Perfil de Rampas de Fermentação
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            {profileSteps.map((s: any, idx: number) => {
                                const isCurrent = isActive && idx === curStepIdx;
                                const isDone = !isActive || idx < curStepIdx;
                                const name = s.name || s.n || `Etapa ${idx + 1}`;
                                const temp = s.temperature ?? s.t ?? 0;
                                const dur = s.duration ?? s.d ?? 0;
                                const trigG = normalizeGravity(s.triggerGravity ?? s.g, 0);
                                return (
                                    <div
                                        key={idx}
                                        className={`p-4 rounded-2xl border transition-all ${
                                            isCurrent
                                                ? 'bg-amber-500/15 border-amber-500/50 text-[var(--ink)]'
                                                : isDone
                                                ? 'bg-[var(--accent)]/10 border-[#2fbf55]/30 text-[var(--muted)]'
                                                : 'bg-[var(--bg)] border-black/[0.07] text-[var(--muted)]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                                            <span className="truncate">{name}</span>
                                            {isDone && <CheckCircle2 size={14} className="text-[#178a3f] shrink-0" />}
                                            {isCurrent && <span className="text-[10px] text-[#b45309] font-mono">ATIVA</span>}
                                        </div>
                                        <div className="text-lg font-mono font-bold text-[var(--ink)]">
                                            {temp}°C <span className="text-xs text-[var(--muted)] font-normal">por {dur}d</span>
                                        </div>
                                        {trigG > 0.980 && (
                                            <div className="text-[10px] font-mono text-[#b45309] mt-1">
                                                🎯 Avança em SG &lt;= {trigG.toFixed(3)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <TemperatureChart
                        data={readings}
                        events={mappedEvents}
                        sensor1Name={batch.sensor1_name || 'Mosto'}
                        sensor2Name={batch.sensor2_name || 'Geladeira'}
                    />
                    <GravityChart
                        data={readings}
                        og={safeOG}
                        fg={safeFG}
                        events={mappedEvents}
                        sensorSgName={batch.sensor_sg_name || 'Densidade (SG)'}
                    />
                </div>
            </div>
        </div>
    );
};
