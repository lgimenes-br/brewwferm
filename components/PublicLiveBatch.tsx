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
            loadBatch();
        }, 30000);
        return () => clearInterval(interval);
    }, [loadBatch]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="animate-spin text-amber-500" size={28} />
                    <p className="text-neutral-400 text-sm font-mono uppercase tracking-widest">Carregando Transmissão Ao Vivo...</p>
                </div>
            </div>
        );
    }

    if (error || !data?.batch) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
                <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-8 max-w-md text-center space-y-3">
                    <h2 className="text-2xl font-black text-white">Link Indisponível</h2>
                    <p className="text-neutral-400 text-sm">{error || 'Este lote não está mais público.'}</p>
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
        <div className="min-h-screen bg-black text-white pb-20">
            {/* Public Spectator Top Bar */}
            <header className="border-b border-neutral-900 bg-black/90 backdrop-blur-md sticky top-0 z-30 px-6 md:px-10 py-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-baseline select-none">
                        <span className="text-3xl font-black text-white tracking-tighter">BREW</span>
                        <div className="relative">
                            <span className="text-3xl font-black text-white tracking-tighter">W</span>
                            <div className="absolute top-0 -right-2 w-2.5 h-1.5 bg-white rounded-tr-sm"></div>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-bold uppercase tracking-widest ${
                        isActive ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                    }`}>
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'}`}></span>
                        <Eye size={13} />
                        {isActive ? 'Ao Vivo • Modo Espectador' : 'Lote Finalizado • Somente Leitura'}
                    </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span className="font-mono hidden sm:inline">Atualizado às {lastRefresh.toLocaleTimeString()}</span>
                    <button
                        type="button"
                        onClick={loadBatch}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-lg font-bold uppercase tracking-wider text-[11px] transition-colors"
                    >
                        <RefreshCw size={12} /> Atualizar
                    </button>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 md:px-10 pt-8 space-y-8">
                {/* Batch Hero */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 uppercase tracking-widest mb-2">
                            <span>Lote #{batch.id}</span>
                            <span>•</span>
                            <span>{batch.device_name || 'Controlador Breww'}</span>
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter">{batch.name || 'Fermentação Ao Vivo'}</h1>
                        {batch.style && (
                            <span className="inline-block mt-2 px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-300 font-bold">
                                {batch.style}
                            </span>
                        )}
                    </div>
                </div>

                {/* Live Telemetry Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 block mb-1">{batch.sensor1_name || 'Mosto'}</span>
                        <span className="text-2xl font-mono font-bold text-white">{currentTemp.toFixed(1)}°C</span>
                    </div>
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-1 mb-1"><Target size={11} /> Set-Point</span>
                        <span className="text-2xl font-mono font-bold text-amber-400">{currentTarget.toFixed(1)}°C</span>
                    </div>
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-1 mb-1"><Snowflake size={11} /> {batch.sensor2_name || 'Geladeira'}</span>
                        <span className="text-2xl font-mono font-bold text-blue-400">{currentFridge.toFixed(1)}°C</span>
                    </div>
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 block mb-1">{batch.sensor_sg_name || 'Densidade'}</span>
                        <span className="text-2xl font-mono font-bold text-purple-400">{currentGravity > 0 ? currentGravity.toFixed(3) : '--'}</span>
                    </div>
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-1 mb-1"><ArrowDown size={11} /> OG / FG</span>
                        <span className="text-sm font-mono font-bold text-white">{safeOG > 0 ? safeOG.toFixed(3) : '--'} → {safeFG > 0 ? safeFG.toFixed(3) : '--'}</span>
                    </div>
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-1 mb-1"><FlaskConical size={11} /> ABV Est.</span>
                        <span className="text-2xl font-mono font-bold text-emerald-400">{abv}%</span>
                    </div>
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-1 mb-1"><Percent size={11} /> Atenuação</span>
                        <span className="text-2xl font-mono font-bold text-white">{attenuation}%</span>
                    </div>
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-1 mb-1"><Battery size={11} /> Bateria</span>
                        <span className="text-2xl font-mono font-bold text-neutral-200">{currentBattery > 0 ? `${currentBattery.toFixed(2)}V` : '--'}</span>
                    </div>
                </div>

                {/* Read-Only Ramp Profile Progress */}
                {Array.isArray(profileSteps) && profileSteps.length > 0 && (
                    <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
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
                                                ? 'bg-amber-500/10 border-amber-500/50 text-white'
                                                : isDone
                                                ? 'bg-emerald-500/5 border-emerald-500/20 text-neutral-400'
                                                : 'bg-black/40 border-neutral-800 text-neutral-500'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-1">
                                            <span className="truncate">{name}</span>
                                            {isDone && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                                            {isCurrent && <span className="text-[10px] text-amber-400 font-mono">ATIVA</span>}
                                        </div>
                                        <div className="text-lg font-mono font-bold text-white">
                                            {temp}°C <span className="text-xs text-neutral-500 font-normal">por {dur}d</span>
                                        </div>
                                        {trigG > 0.980 && (
                                            <div className="text-[10px] font-mono text-amber-400 mt-1">
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
