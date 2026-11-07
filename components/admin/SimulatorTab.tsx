import { useState, useEffect, useCallback } from 'react';
import { Cpu, Power, Play, Square, Sliders, Activity, Wifi, Battery, Thermometer, Droplets, Terminal, Link2, Unlink, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
    fetchSimulatorStatus,
    updateSimulatorState,
    triggerSimulatorDeviceAction,
    clearSimulatorCommandLog,
    linkSimulatorDevice
} from '../../services/api';
import { useFermenters } from '../../hooks/useFermenters';
import toast from 'react-hot-toast';

export const SimulatorTab = ({ compact = false }: { compact?: boolean }) => {
    const { token } = useAuth();
    const { fermenters, refetch } = useFermenters();
    const [simState, setSimState] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const loadStatus = useCallback(async () => {
        if (!token) return;
        try {
            const data = await fetchSimulatorStatus(token);
            setSimState(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadStatus();
        const interval = setInterval(() => {
            if (typeof document === 'undefined' || !document.hidden) {
                loadStatus();
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [loadStatus]);

    const applyPatch = async (patch: Record<string, any>, successMsg?: string) => {
        if (!token) return;
        setBusy(true);
        try {
            const updated = await updateSimulatorState(patch, token);
            setSimState(updated);
            refetch();
            if (successMsg) toast.success(successMsg);
        } catch (err: any) {
            toast.error(err.message || 'Erro ao atualizar ESP32 Virtual');
        } finally {
            setBusy(false);
        }
    };

    const handleSelectTargetSerial = async (targetSerial: string) => {
        if (!token) return;
        setBusy(true);
        try {
            const res = await linkSimulatorDevice({ serial: targetSerial, unlink: false }, token);
            toast.success(`Simulando dispositivo ${res.serial}!`);
            await loadStatus();
            refetch();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao trocar serial simulado');
        } finally {
            setBusy(false);
        }
    };

    const handleLinkDevice = async (unlink = false) => {
        if (!token) return;
        setBusy(true);
        try {
            const res = await linkSimulatorDevice({ serial: simState?.serial || 'ESP32-VIRTUAL-01', unlink }, token);
            toast.success(res.message);
            await loadStatus();
            refetch();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao vincular/desvincular dispositivo');
        } finally {
            setBusy(false);
        }
    };

    const handlePhysicalAction = async (action: 'start_batch' | 'stop_batch') => {
        if (!token) return;
        setBusy(true);
        try {
            const updated = await triggerSimulatorDeviceAction(
                action === 'start_batch'
                    ? {
                        action: 'start_batch',
                        name: 'IPA Iniciada na Placa Física',
                        style: 'American IPA',
                        profile: [
                            { n: 'Primária (Tela Física)', t: 18.5, d: 120 },
                            { n: 'Descanso Diacetil', t: 21.5, d: 48 },
                            { n: 'Cold Crash', t: 1.5, d: 48 }
                        ]
                    }
                    : { action: 'stop_batch' },
                token
            );
            setSimState(updated);
            toast.success(action === 'start_batch'
                ? 'Lote iniciado pela tela física virtual (device_action)!'
                : 'Lote encerrado pela tela física virtual!');
            refetch();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao simular ação na tela física');
        } finally {
            setBusy(false);
        }
    };

    const handleClearLogs = async () => {
        if (!token) return;
        try {
            const updated = await clearSimulatorCommandLog(token);
            setSimState(updated);
            toast.success('Log de comandos limpo');
        } catch (e) {}
    };

    if (loading || !simState) {
        return (
            <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const modeLabel = simState.opm === 0 ? 'FERMENTADOR' : simState.opm === 1 ? 'GELADEIRA' : 'CHOPEIRA';

    return (
        <div className="space-y-6">
            {/* Header & Power Control */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                <div className="flex items-start sm:items-center gap-3">
                    <div className={`p-3 rounded-xl border ${simState.enabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-neutral-800 border-neutral-700 text-neutral-400'}`}>
                        <Cpu size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg md:text-xl font-black text-white">Bancada ESP32 Virtual</h2>
                            <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-xs border border-neutral-700">
                                {simState.serial}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${simState.enabled ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-neutral-800 text-neutral-500 border-neutral-700'}`}>
                                {simState.enabled ? 'Transmitindo MQTT (3s)' : 'Desligado'}
                            </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-1">
                            Responde exatamente aos mesmos tópicos MQTT (<code className="text-neutral-300">brewbrother/{simState.serial}/comando</code>) de uma placa física real.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleLinkDevice(false)}
                        className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold flex items-center gap-1.5 border border-neutral-700 transition-colors"
                        title="Cadastra o ESP32 Virtual na sua conta e já o liga"
                    >
                        <Link2 size={14} /> Vincular à Minha Conta
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleLinkDevice(true)}
                        className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold flex items-center gap-1.5 border border-neutral-800 transition-colors"
                        title="Remove do banco mantendo ligado no MQTT para aparecer em Buscar na Rede (Discovery)"
                    >
                        <Unlink size={14} /> Testar Discovery
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => applyPatch({ enabled: !simState.enabled }, simState.enabled ? 'ESP32 Virtual desligado' : 'ESP32 Virtual ligado e publicando MQTT!')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
                            simState.enabled
                                ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-400'
                        }`}
                    >
                        <Power size={15} />
                        {simState.enabled ? 'Desligar Placa' : 'Ligar Placa Virtual'}
                    </button>
                </div>
            </div>

            {/* Quick Device Serial Selector */}
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-neutral-400">
                    <span className="font-bold text-white">Qual dispositivo você quer simular agora?</span> Escolha a placa virtual dedicada ou dê vida a uma das suas placas cadastradas:
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSelectTargetSerial('ESP32-VIRTUAL-01')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                            simState.serial === 'ESP32-VIRTUAL-01'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white'
                        }`}
                    >
                        ESP32 Virtual (ESP32-VIRTUAL-01)
                    </button>
                    {fermenters
                        .filter(f => f.id.toUpperCase() !== 'ESP32-VIRTUAL-01')
                        .map(f => {
                            const active = simState.serial === f.id.toUpperCase();
                            return (
                                <button
                                    key={f.id}
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleSelectTargetSerial(f.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                                        active
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                            : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white'
                                    }`}
                                >
                                    {f.name} ({f.id})
                                </button>
                            );
                        })}
                </div>
            </div>

            {/* Live Hardware Status Bar */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3">
                    <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Modo (opm)</div>
                    <div className="text-sm font-black text-white mt-0.5">{modeLabel}</div>
                </div>
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3">
                    <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Status Relé (statOp)</div>
                    <div className="text-sm font-black text-indigo-400 mt-0.5 truncate">{simState.statOp}</div>
                </div>
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3">
                    <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Setpoint (csp)</div>
                    <div className="text-sm font-black text-white mt-0.5">{Number(simState.csp).toFixed(1)}°C</div>
                </div>
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3">
                    <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Rampa Ativa</div>
                    <div className="text-sm font-black text-white mt-0.5 truncate">
                        #{Number(simState.currStep) + 1} {simState.profStat}
                    </div>
                </div>
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3">
                    <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Offsets (T1/T2/SG)</div>
                    <div className="text-xs font-mono text-neutral-300 mt-1">
                        {simState.off_t1}/{simState.off_t2}/{simState.off_sg}
                    </div>
                </div>
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3">
                    <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Firmware / IP</div>
                    <div className="text-xs font-mono text-neutral-300 mt-1 truncate">
                        {simState.ver} • {simState.ip}
                    </div>
                </div>
            </div>

            <div className={`grid grid-cols-1 ${compact ? '' : 'lg:grid-cols-2'} gap-6`}>
                {/* Bench Sliders & Physics Toggle */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-5">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                        <div className="flex items-center gap-2">
                            <Sliders size={18} className="text-indigo-400" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sensores & Bancada de Testes</h3>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
                            <input
                                type="checkbox"
                                checked={Boolean(simState.autoPhysics)}
                                onChange={(e) => applyPatch({ autoPhysics: e.target.checked })}
                                className="rounded border-neutral-700 bg-black text-indigo-500"
                            />
                            Física Térmica Automática
                        </label>
                    </div>

                    {/* Sensor 1: Beer Temp */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <label htmlFor="sim-ferm-slider" className="text-neutral-400 font-bold flex items-center gap-1.5">
                                <Thermometer size={14} className="text-amber-400" /> Temp. Mosto / Sensor 1 (<code className="text-neutral-500">ferm</code>)
                            </label>
                            <span className="font-mono font-bold text-white">{Number(simState.ferm).toFixed(1)}°C</span>
                        </div>
                        <input
                            id="sim-ferm-slider"
                            type="range"
                            min="-2"
                            max="35"
                            step="0.1"
                            value={simState.ferm}
                            onChange={(e) => setSimState({ ...simState, ferm: parseFloat(e.target.value) })}
                            onMouseUp={() => applyPatch({ autoPhysics: false, ferm: simState.ferm })}
                            onTouchEnd={() => applyPatch({ autoPhysics: false, ferm: simState.ferm })}
                            className="w-full accent-indigo-500"
                        />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            <button type="button" onClick={() => applyPatch({ autoPhysics: false, ferm: Number(simState.csp) }, 'Temperatura igualada ao Setpoint')} className="px-2 py-1 text-[10px] rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300">
                                Igualar ao Alvo ({Number(simState.csp).toFixed(1)}°C)
                            </button>
                            <button type="button" onClick={() => applyPatch({ autoPhysics: false, ferm: Number(simState.csp) + 3.0 }, 'Simulando desvio de +3°C acima do alvo')} className="px-2 py-1 text-[10px] rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20">
                                Simular Superaquecimento (+3°C)
                            </button>
                            <button type="button" onClick={() => applyPatch({ autoPhysics: false, ferm: 1.5, amb: 0.5 }, 'Simulando Cold Crash (1.5°C)')} className="px-2 py-1 text-[10px] rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20">
                                Cold Crash (1.5°C)
                            </button>
                        </div>
                    </div>

                    {/* Sensor 2: Fridge Temp */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <label htmlFor="sim-amb-slider" className="text-neutral-400 font-bold flex items-center gap-1.5">
                                <Thermometer size={14} className="text-sky-400" /> Temp. Geladeira / Sensor 2 (<code className="text-neutral-500">amb</code>)
                            </label>
                            <span className="font-mono font-bold text-white">{Number(simState.amb).toFixed(1)}°C</span>
                        </div>
                        <input
                            id="sim-amb-slider"
                            type="range"
                            min="-5"
                            max="35"
                            step="0.1"
                            value={simState.amb}
                            onChange={(e) => setSimState({ ...simState, amb: parseFloat(e.target.value) })}
                            onMouseUp={() => applyPatch({ autoPhysics: false, amb: simState.amb })}
                            onTouchEnd={() => applyPatch({ autoPhysics: false, amb: simState.amb })}
                            className="w-full accent-indigo-500"
                        />
                    </div>

                    {/* iSpindel Gravity (SG) */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <label htmlFor="sim-sg-slider" className="text-neutral-400 font-bold flex items-center gap-1.5">
                                <Droplets size={14} className="text-purple-400" /> Densidade iSpindel (<code className="text-neutral-500">is_sg</code>)
                            </label>
                            <span className="font-mono font-bold text-white">{Number(simState.is_sg).toFixed(3)}</span>
                        </div>
                        <input
                            id="sim-sg-slider"
                            type="range"
                            min="0.998"
                            max="1.110"
                            step="0.001"
                            value={simState.is_sg}
                            onChange={(e) => setSimState({ ...simState, is_sg: parseFloat(e.target.value) })}
                            onMouseUp={() => applyPatch({ is_sg: simState.is_sg })}
                            onTouchEnd={() => applyPatch({ is_sg: simState.is_sg })}
                            className="w-full accent-indigo-500"
                        />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            <button type="button" onClick={() => applyPatch({ is_sg: 1.055 }, 'SG ajustada para 1.055 (Início)')} className="px-2 py-1 text-[10px] rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300">
                                OG Inicial (1.055)
                            </button>
                            <button type="button" onClick={() => applyPatch({ is_sg: 1.018 }, 'SG ajustada para 1.018 (Testar Gatilho de Rampa)')} className="px-2 py-1 text-[10px] rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30">
                                🎯 Testar Gatilho SG (1.018)
                            </button>
                            <button type="button" onClick={() => applyPatch({ is_sg: 1.010 }, 'SG ajustada para 1.010 (FG Final)')} className="px-2 py-1 text-[10px] rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30">
                                FG Final (1.010)
                            </button>
                        </div>
                    </div>

                    {/* iSpindel Battery & Wi-Fi RSSI */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <label htmlFor="sim-bat-slider" className="text-neutral-400 font-bold flex items-center gap-1">
                                    <Battery size={14} className="text-emerald-400" /> Bateria (<code className="text-neutral-500">is_bat</code>)
                                </label>
                                <span className="font-mono font-bold text-white">{Number(simState.is_bat).toFixed(2)}V</span>
                            </div>
                            <input
                                id="sim-bat-slider"
                                type="range"
                                min="3.10"
                                max="4.20"
                                step="0.05"
                                value={simState.is_bat}
                                onChange={(e) => setSimState({ ...simState, is_bat: parseFloat(e.target.value) })}
                                onMouseUp={() => applyPatch({ is_bat: simState.is_bat })}
                                onTouchEnd={() => applyPatch({ is_bat: simState.is_bat })}
                                className="w-full accent-indigo-500"
                            />
                            <button type="button" onClick={() => applyPatch({ is_bat: 3.32 }, 'Simulando bateria fraca (3.32V)')} className="w-full py-1 text-[10px] rounded bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20">
                                🪫 Simular Bateria Fraca (3.32V)
                            </button>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <label htmlFor="sim-rssi-slider" className="text-neutral-400 font-bold flex items-center gap-1">
                                    <Wifi size={14} className="text-indigo-400" /> Sinal Wi-Fi (<code className="text-neutral-500">rssi</code>)
                                </label>
                                <span className="font-mono font-bold text-white">{simState.rssi} dBm</span>
                            </div>
                            <input
                                id="sim-rssi-slider"
                                type="range"
                                min="-92"
                                max="-35"
                                step="1"
                                value={simState.rssi}
                                onChange={(e) => setSimState({ ...simState, rssi: parseInt(e.target.value, 10) })}
                                onMouseUp={() => applyPatch({ rssi: simState.rssi })}
                                onTouchEnd={() => applyPatch({ rssi: simState.rssi })}
                                className="w-full accent-indigo-500"
                            />
                            <button type="button" onClick={() => applyPatch({ rssi: -86 }, 'Simulando sinal Wi-Fi crítico (-86 dBm)')} className="w-full py-1 text-[10px] rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20">
                                📡 Simular Sinal Crítico (-86 dBm)
                            </button>
                        </div>
                    </div>
                </div>

                {/* Physical Screen Actions & Received Command Log */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between space-y-5">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                            <div className="flex items-center gap-2">
                                <Activity size={18} className="text-emerald-400" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Simular Tela Touch Física (ESP32 → Nuvem)</h3>
                            </div>
                        </div>
                        <p className="text-xs text-neutral-400">
                            Simula o cervejeiro iniciando ou parando uma brassagem diretamente no display touch de 3.5&quot;/7&quot; do fermentador (<code className="text-neutral-300">brewbrother/{simState.serial}/device_action</code>):
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => handlePhysicalAction('start_batch')}
                                className="py-2.5 px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                <Play size={15} /> Iniciar Lote na Placa Física
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => handlePhysicalAction('stop_batch')}
                                className="py-2.5 px-4 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                <Square size={15} /> Parar Lote na Placa Física
                            </button>
                        </div>
                    </div>

                    {/* Command Log received by the Virtual ESP32 */}
                    <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Terminal size={14} className="text-indigo-400" /> Comandos Recebidos pelo ESP32 ({Array.isArray(simState.commandLog) ? simState.commandLog.length : 0})
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={loadStatus}
                                    className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
                                    title="Atualizar estado"
                                >
                                    <RefreshCw size={12} />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClearLogs}
                                    className="text-xs text-neutral-500 hover:text-red-400 flex items-center gap-1"
                                    title="Limpar log"
                                >
                                    <Trash2 size={12} /> Limpar
                                </button>
                            </div>
                        </div>

                        <div className="bg-black border border-neutral-800 rounded-xl p-3 h-48 overflow-y-auto font-mono text-[11px] space-y-1.5">
                            {Array.isArray(simState.commandLog) && simState.commandLog.length > 0 ? (
                                simState.commandLog.map((entry: any) => (
                                    <div key={entry.id} className="border-b border-neutral-900 pb-1">
                                        <span className="text-neutral-500">[{new Date(entry.timestamp).toLocaleTimeString('pt-BR')}]</span>{' '}
                                        <span className="text-emerald-400 font-bold">{entry.type}</span>{' '}
                                        <span className="text-neutral-300 break-all">{JSON.stringify(entry.payload)}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-neutral-600 text-center py-12">
                                    Envie qualquer comando pelo painel (mudar temperatura, rampa, modo chopeira, escanear sensores, PID ou OTA) para ver o ESP32 Virtual recebê-lo aqui em tempo real.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
