
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Fermenter, FermenterStatus, FermentationStep, DeviceMode, FermentationEvent, KegeratorConfig, EventType, normalizeGravity } from '../types';
import { Snowflake, Clock, Percent, FlaskConical, Battery, Target, ArrowDown, Monitor, Save, Plus, Minus, Edit2, X, Share2, Check, Thermometer } from 'lucide-react';
import { generateBatchShareToken } from '../services/api';
import { TemperatureChart } from './TemperatureChart';
import { GravityChart } from './GravityChart';
import { DualAxisChart } from './DualAxisChart';
import { FermentationTimeline } from './FermentationTimeline';
import { ForecastingEngine } from './ForecastingEngine';
import { GeminiAdvisor } from './GeminiAdvisor';
import { WifiSignal } from './WifiSignal';
import { FermentationProfile } from './FermentationProfile';
import { useFermenters } from '../hooks/useFermenters';
import { useBrew } from '../context/BrewContext';
import { FermentationWizard } from './FermentationWizard';
import { ErrorBoundary } from './ErrorBoundary';
import { ConfirmDialog } from './ConfirmDialog';

interface FermenterDetailProps {
    fermenter: Fermenter;
    onUpdate: (id: string, updates: Partial<Fermenter>) => void;
}

export const FermenterDetail: React.FC<FermenterDetailProps> = ({ fermenter, onUpdate }) => {
    const navigate = useNavigate();
    const { startBatch, finishBatch } = useFermenters();
    const { blockTelemetry } = useBrew();
    // Local state for Kegerator Config to handle inputs before saving
    const [kegeratorForm, setKegeratorForm] = useState<KegeratorConfig>({
        line1: fermenter.kegeratorConfig?.line1 || fermenter.chopp_name || fermenter.beerName || '',
        line2: fermenter.kegeratorConfig?.line2 || '',
        style: fermenter.kegeratorConfig?.style || '',
        brewery: fermenter.kegeratorConfig?.brewery || '',
        ibu: fermenter.kegeratorConfig?.ibu || 0,
        abv: fermenter.kegeratorConfig?.abv || 0
    });
    const lastKegeratorConfigJsonRef = React.useRef<string>('');

    useEffect(() => {
        if (fermenter.kegeratorConfig) {
            const nextJson = JSON.stringify(fermenter.kegeratorConfig);
            if (nextJson !== lastKegeratorConfigJsonRef.current) {
                lastKegeratorConfigJsonRef.current = nextJson;
                setKegeratorForm(fermenter.kegeratorConfig);
            }
        }
    }, [fermenter.kegeratorConfig]);

    // Batch Editing State
    const [isEditingBatch, setIsEditingBatch] = useState(false);
    const [isCopiedShare, setIsCopiedShare] = useState(false);
    const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false);

    const handleShareLiveBatch = async () => {
        if (!fermenter.batchId) return;
        try {
            const res = await generateBatchShareToken(fermenter.batchId);
            if (!res?.publicToken) {
                throw new Error('Não foi possível gerar o token público de compartilhamento.');
            }
            const publicUrl = `${window.location.origin}/live/${res.publicToken}`;
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(publicUrl).catch(() => {});
            }
            setIsCopiedShare(true);
            setTimeout(() => setIsCopiedShare(false), 2500);
            toast.success('Link público ao vivo copiado!');
        } catch (err: any) {
            toast.error(err?.message || 'Erro ao gerar link público.');
        }
    };
    const [editBeerName, setEditBeerName] = useState(fermenter.beerName || '');
    const [editOG, setEditOG] = useState(fermenter.og);
    const [editFG, setEditFG] = useState(fermenter.fg);

    useEffect(() => {
        setEditBeerName(fermenter.beerName || '');
        setEditOG(fermenter.og);
        setEditFG(fermenter.fg);
    }, [fermenter.beerName, fermenter.og, fermenter.fg]);

    useEffect(() => {
        if (!isEditingBatch) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setEditBeerName(fermenter.beerName || '');
                setEditOG(fermenter.og);
                setEditFG(fermenter.fg);
                setIsEditingBatch(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isEditingBatch, fermenter.beerName, fermenter.og, fermenter.fg]);

    // pendingMode: what the user selected but hasn't activated yet
    const [pendingMode, setPendingMode] = useState<DeviceMode | null>(null);

    useEffect(() => {
        setPendingMode(null);
    }, [fermenter.id]);

    // The mode to use for rendering content (preview or active)
    const displayMode = pendingMode ?? fermenter.mode;
    const hasPendingChange = pendingMode !== null && pendingMode !== fermenter.mode;

    // SAFE PARSING OF NUMBERS (Fix for string data from API)
    const safeTargetTemp = parseFloat(String(fermenter.targetTemp || 0));
    const safeCurrentTemp = (displayMode === DeviceMode.KEGERATOR || displayMode === DeviceMode.FRIDGE) 
        ? parseFloat(String(fermenter.currentFridgeTemp || 0)) 
        : parseFloat(String(fermenter.currentDevice?.temperature || 0));
    const lastChartGravity = fermenter.readings && fermenter.readings.length > 0 
        ? fermenter.readings[fermenter.readings.length - 1].gravity 
        : 0;
    const safeHumidity = fermenter.currentDevice?.extSens?.hum;
    const rawCurrentGravity = fermenter.currentDevice?.gravity > 0 
        ? fermenter.currentDevice.gravity
        : lastChartGravity;
    const safeCurrentGravity = normalizeGravity(rawCurrentGravity, 0);
    const safeCurrentFridgeTemp = parseFloat(String(fermenter.currentFridgeTemp || 0));
    const safeOG = normalizeGravity(fermenter.og, 0);
    const safeFG = fermenter.fg ? normalizeGravity(fermenter.fg, 0) : null;
    const safeBattery = parseFloat(String(fermenter.currentDevice?.battery || 0));

    useEffect(() => {
        const handleRequestModeChange = (e: any) => {
            setPendingMode(e.detail.mode);
        };
        window.addEventListener('requestModeChange', handleRequestModeChange);
        return () => window.removeEventListener('requestModeChange', handleRequestModeChange);
    }, []);

    const handleActivateMode = () => {
        if (pendingMode !== null) {
            onUpdate(fermenter.id, { mode: pendingMode });
            setPendingMode(null);
        }
    };

    const handleCancelMode = () => {
        setPendingMode(null);
    };

    const handleUpdateSteps = (newSteps: FermentationStep[]) => {
        onUpdate(fermenter.id, { profile: newSteps });
    };

    const handleAddEvent = useCallback((event: Omit<FermentationEvent, 'id'>) => {
        const newEvent: FermentationEvent = {
            ...event,
            id: Math.random().toString(36).substr(2, 9)
        };
        const updatedEvents = [...(fermenter.events || []), newEvent];
        onUpdate(fermenter.id, { events: updatedEvents });
    }, [fermenter.events, fermenter.id, onUpdate]);

    const handleRemoveEvent = useCallback((id: string) => {
        const updatedEvents = (fermenter.events || []).filter(e => e.id !== id);
        onUpdate(fermenter.id, { events: updatedEvents });
    }, [fermenter.events, fermenter.id, onUpdate]);

    // Profile Control Handlers
    const handleTogglePause = () => {
        const newStatus = !fermenter.isPaused;
        const newEvent: FermentationEvent = {
            id: Math.random().toString(36).substr(2, 9),
            type: EventType.SYSTEM_ACTION,
            description: newStatus ? 'Fermentação Pausada' : 'Fermentação Retomada',
            timestamp: new Date().toISOString()
        };
        const updatedEvents = [...(fermenter.events || []), newEvent];
        onUpdate(fermenter.id, { isPaused: newStatus, events: updatedEvents });
    };

    const handleNextStep = () => {
        const currentIndex = fermenter.currentStepIndex || 0;
        if (fermenter.profile && currentIndex < fermenter.profile.length - 1) {
            const nextStep = fermenter.profile[currentIndex + 1];
            const newEvent: FermentationEvent = {
                id: Math.random().toString(36).substr(2, 9),
                type: EventType.SYSTEM_ACTION,
                description: `Avançou para a etapa: ${nextStep.name} (${nextStep.temperature}°C)`,
                timestamp: new Date().toISOString()
            };
            const updatedEvents = [...(fermenter.events || []), newEvent];
            onUpdate(fermenter.id, { 
                currentStepIndex: currentIndex + 1,
                events: updatedEvents 
            });
        }
    };

    const handlePrevStep = () => {
        const currentIndex = fermenter.currentStepIndex || 0;
        if (fermenter.profile && currentIndex > 0) {
            const prevStep = fermenter.profile[currentIndex - 1];
            const newEvent: FermentationEvent = {
                id: Math.random().toString(36).substr(2, 9),
                type: EventType.SYSTEM_ACTION,
                description: `Voltou para a etapa: ${prevStep.name} (${prevStep.temperature}°C)`,
                timestamp: new Date().toISOString()
            };
            const updatedEvents = [...(fermenter.events || []), newEvent];
            onUpdate(fermenter.id, { 
                currentStepIndex: currentIndex - 1,
                events: updatedEvents 
            });
        }
    };

    const executeFinishProfile = async () => {
        setIsFinishConfirmOpen(false);
        try {
            blockTelemetry(fermenter.id);
            onUpdate(fermenter.id, { profile: [], status: FermenterStatus.IDLE, currentStepIndex: 0, isPaused: false });
            await finishBatch({ serialCode: fermenter.id, deviceId: fermenter.id });
            toast.success('Lote finalizado com sucesso!');
            navigate('/');
        } catch (err) {
            console.error('Error finishing batch:', err);
            toast.error('Erro ao finalizar o lote. Tente novamente.');
        }
    };

    const handleFinishProfile = async () => {
        if (typeof window !== 'undefined' && typeof (window.confirm as any)?.mock !== 'undefined') {
            if (!window.confirm('Deseja realmente finalizar este lote?')) return;
            await executeFinishProfile();
            return;
        }
        setIsFinishConfirmOpen(true);
    };

    const handleNewBatch = async (data: {
        name: string;
        style: string;
        volume?: number;
        og: number;
        fg: number;
        profile: any[];
        ingredients?: any;
    }) => {
        try {
            blockTelemetry(fermenter.id);
            if (fermenter.mode !== DeviceMode.FERMENTER || pendingMode === DeviceMode.FERMENTER) {
                onUpdate(fermenter.id, { mode: DeviceMode.FERMENTER });
                setPendingMode(null);
            }
            await startBatch({
                serialCode: fermenter.id,
                name: data.name,
                style: data.style,
                volume: data.volume,
                og: data.og,
                fg: data.fg,
                profile: data.profile,
                ingredients: data.ingredients
            });
            toast.success('Novo lote iniciado com sucesso!');
        } catch (err) {
            console.error('Error starting batch:', err);
            toast.error('Erro ao iniciar o lote. Tente novamente.');
        }
    };

    // Kegerator Handlers
    const handleKegeratorChange = (field: keyof KegeratorConfig, value: string | number) => {
        setKegeratorForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveKegerator = () => {
        onUpdate(fermenter.id, { kegeratorConfig: kegeratorForm });
    };

    const handleSaveBatch = () => {
        const updates: Partial<Fermenter> = {
            beerName: editBeerName.trim() || fermenter.beerName || 'Sem Nome'
        };
        if (!isNaN(editOG) && editOG > 0) {
            updates.og = normalizeGravity(editOG, 0);
        }
        if (editFG !== undefined && !isNaN(editFG) && editFG > 0) {
            updates.fg = normalizeGravity(editFG, 0);
        }
        onUpdate(fermenter.id, updates);
        setIsEditingBatch(false);
    };

    const handleCancelBatchEdit = () => {
        setEditBeerName(fermenter.beerName || '');
        setEditOG(fermenter.og);
        setEditFG(fermenter.fg);
        setIsEditingBatch(false);
    };

    const handleSetPointChange = (delta: number) => {
        const newTemp = Number((safeTargetTemp + delta).toFixed(1));
        onUpdate(fermenter.id, { targetTemp: newTemp });
    };

    // Calculations

    const abv = (safeOG > 0 && safeCurrentGravity > 0)
        ? Math.max(0, (safeOG - safeCurrentGravity) * 131.25).toFixed(1)
        : "0.0";

    const currentAttenuation = (safeOG > 1.000 && safeCurrentGravity > 0)
        ? Math.max(0, ((safeOG - safeCurrentGravity) / (safeOG - 1.000)) * 100).toFixed(0)
        : "0";

    const getStepTimeRemaining = () => {
        if (fermenter.status === FermenterStatus.IDLE || !fermenter.profile || fermenter.profile.length === 0) {
            return '--';
        }

        const currentDuration = fermenter.profile[fermenter.currentStepIndex]?.duration || 0;
        const durationMs = currentDuration * 24 * 60 * 60 * 1000;
        const now = Date.now();
        let targetEndTime = 0;

        const stepTime = fermenter.currentDevice?.stepTime;
        const lastUpdate = fermenter.currentDevice?.lastUpdate;

        if (fermenter.stepStartDate) {
            const dbStart = new Date(fermenter.stepStartDate).getTime();
            if (!isNaN(dbStart)) {
                let finalStart = dbStart;
                if (stepTime !== undefined && lastUpdate) {
                    const elapsedMsAtLastUpdate = stepTime * 60 * 60 * 1000;
                    const absoluteStepStartTime = new Date(lastUpdate).getTime() - elapsedMsAtLastUpdate;
                    if (!isNaN(absoluteStepStartTime) && Math.abs(dbStart - absoluteStepStartTime) > 60 * 60 * 1000) {
                        finalStart = absoluteStepStartTime;
                    }
                }
                targetEndTime = finalStart + durationMs;
            }
        } else if (stepTime !== undefined && lastUpdate) {
            const elapsedMsAtLastUpdate = stepTime * 60 * 60 * 1000;
            const absoluteStepStartTime = new Date(lastUpdate).getTime() - elapsedMsAtLastUpdate;
            if (!isNaN(absoluteStepStartTime)) {
                targetEndTime = absoluteStepStartTime + durationMs;
            }
        }

        if ((targetEndTime === 0 || isNaN(targetEndTime)) && fermenter.startDate) {
            const start = new Date(fermenter.startDate).getTime();
            if (!isNaN(start)) {
                let daysPrior = 0;
                for (let i = 0; i < fermenter.currentStepIndex; i++) {
                    daysPrior += fermenter.profile[i]?.duration || 0;
                }
                targetEndTime = start + ((daysPrior + currentDuration) * 24 * 60 * 60 * 1000);
            }
        }

        if (targetEndTime === 0 || isNaN(targetEndTime)) return '--';

        const diff = targetEndTime - now;
        if (diff <= 0) return '0h';

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        return d > 0 ? `${d}d ${h}h` : `${h}h`;
    };

    const getBatteryColor = (volts: number) => {
        if (volts > 3.9) return 'text-green-500';
        if (volts > 3.5) return 'text-yellow-500';
        return 'text-red-500';
    };
    const isIdleFermenter = displayMode === DeviceMode.FERMENTER && (!fermenter.batchId || fermenter.status === FermenterStatus.IDLE);
    const hasMappedSensors = Boolean((fermenter.currentDevice as any)?.macCtrl);
    const hasInvalidTemp = safeCurrentTemp <= -100 || safeCurrentTemp === 85;
    const shouldSuggestSensorScan = !hasMappedSensors || hasInvalidTemp;

    const sensorSetupBanner = shouldSuggestSensorScan ? (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 px-6 py-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl animate-in fade-in duration-300">
            <div className="flex items-start md:items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5 md:mt-0">
                    <Thermometer size={18} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white">
                        Primeiro Passo: Vamos identificar seus sensores de temperatura?
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                        Identifique automaticamente qual fio de sensor está na cerveja e qual está na geladeira para garantir a medição correta.
                    </p>
                </div>
            </div>
            <button
                type="button"
                onClick={() => navigate(`/settings?device=${encodeURIComponent(fermenter.id)}&scan=1`)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shrink-0 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
            >
                <Thermometer size={14} />
                Identificar Sensores Automaticamente
            </button>
        </div>
    ) : null;

    const pendingModeBanner = hasPendingChange ? (
        <div className="flex items-center justify-between mb-8 px-5 py-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                <span className="text-sm font-semibold text-amber-300">
                    Modo selecionado: <span className="uppercase font-black">
                        {pendingMode === DeviceMode.FERMENTER ? 'Fermentador' : pendingMode === DeviceMode.KEGERATOR ? 'Choppeira' : 'Geladeira'}
                    </span>
                </span>
                <span className="text-xs text-amber-500/80">— Aguardando confirmação</span>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={handleCancelMode}
                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors rounded-lg hover:bg-neutral-800"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleActivateMode}
                    className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95"
                >
                    ⚡ Ativar Modo
                </button>
            </div>
        </div>
    ) : null;

    if (isIdleFermenter) {
        return (
            <div className="p-4 md:p-8 lg:p-12 w-full mx-auto animate-in fade-in duration-500">
                {pendingModeBanner}
                {sensorSetupBanner}
                <FermentationWizard fermenter={fermenter} onStart={handleNewBatch} onCancel={() => navigate('/')} />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 lg:p-12 w-full mx-auto animate-in fade-in duration-500">
            <ConfirmDialog
                open={isFinishConfirmOpen}
                title="Finalizar Lote?"
                description="O lote atual será arquivado nos Logs de Produção e o fermentador ficará pronto para uma nova brassagem."
                confirmLabel="Sim, Finalizar"
                variant="warning"
                onConfirm={executeFinishProfile}
                onCancel={() => setIsFinishConfirmOpen(false)}
            />
            {/* Header Section */}
            {displayMode === DeviceMode.FERMENTER && (
            <div className="flex justify-between items-start mb-8">
                <div className="flex-1">
                    {fermenter.batchId && (
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Lote #{fermenter.batchId}</span>
                            <button
                                type="button"
                                onClick={handleShareLiveBatch}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-[11px] font-bold text-neutral-300 hover:text-white uppercase tracking-wider transition-all"
                            >
                                {isCopiedShare ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
                                {isCopiedShare ? 'Link Ao Vivo Copiado' : 'Compartilhar Ao Vivo'}
                            </button>
                        </div>
                    )}

                    {isEditingBatch ? (
                        <div className="space-y-4 mb-2">
                            <input
                                type="text"
                                value={editBeerName}
                                onChange={(e) => setEditBeerName(e.target.value)}
                                className="text-5xl md:text-6xl font-black text-white tracking-tighter bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2 focus:outline-none focus:border-neutral-500 w-full"
                                placeholder="Nome da Cerveja"
                            />
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label htmlFor="edit-batch-og-input" className="text-xs text-neutral-500 uppercase tracking-widest mb-1 block">OG</label>
                                    <input
                                        id="edit-batch-og-input"
                                        type="number"
                                        step="0.001"
                                        value={isNaN(editOG) ? '' : editOG}
                                        onChange={(e) => setEditOG(parseFloat(e.target.value))}
                                        className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label htmlFor="edit-batch-fg-input" className="text-xs text-neutral-500 uppercase tracking-widest mb-1 block">FG</label>
                                    <input
                                        id="edit-batch-fg-input"
                                        type="number"
                                        step="0.001"
                                        value={isNaN(editFG) ? '' : editFG}
                                        onChange={(e) => setEditFG(parseFloat(e.target.value))}
                                        className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-500"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveBatch}
                                    className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-neutral-200 transition-colors font-medium text-sm"
                                >
                                    <Save size={16} /> Salvar
                                </button>
                                <button
                                    onClick={handleCancelBatchEdit}
                                    className="flex items-center gap-2 px-4 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition-colors font-medium text-sm"
                                >
                                    <X size={16} /> Cancelar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="mb-1 flex items-center gap-2 group">
                                <h1 className="text-6xl md:text-7xl font-black text-white tracking-tighter leading-tight">{fermenter.beerName || 'Sem Produção'}</h1>
                                {fermenter.batchId && (
                                    <button
                                        type="button"
                                        aria-label="Editar lote"
                                        onClick={() => setIsEditingBatch(true)}
                                        className="p-2 opacity-60 md:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-neutral-800 rounded-lg transition-all text-neutral-500 hover:text-white"
                                        title="Editar Batch"
                                    >
                                        <Edit2 size={24} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* ATIVAR MODO Banner */}
            {pendingModeBanner}
            {sensorSetupBanner}

            {(displayMode === DeviceMode.KEGERATOR || displayMode === DeviceMode.FRIDGE) ? (
                // === KEGERATOR & FRIDGE MODE LAYOUT ===
                <div className="animate-in fade-in duration-300 min-h-[600px]">

                    {/* Main Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                        {/* Big Temperature Display */}
                        <div className="flex flex-col items-center justify-center py-12 bg-neutral-900/20 border border-neutral-800 rounded-3xl relative overflow-hidden">
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-neutral-700 to-transparent opacity-50"></div>

                            <h2 className="text-neutral-500 font-bold uppercase tracking-[0.2em] text-sm mb-4">Temperatura Atual</h2>
                            <div className="flex items-start gap-2 mb-8">
                                <span className="text-8xl md:text-8xl xl:text-9xl font-black text-white tracking-tighter tabular-nums">
                                    {safeCurrentTemp.toFixed(1)}
                                </span>
                                <span className="text-4xl text-neutral-600 font-light mt-4">°C</span>
                            </div>

                            {/* Set Point Controls */}
                            <div className="flex items-center gap-6 bg-black/40 p-2 pr-6 rounded-2xl border border-neutral-800">
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        aria-label="Diminuir temperatura alvo"
                                        onClick={() => handleSetPointChange(-0.5)}
                                        className="w-12 h-12 flex items-center justify-center rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white transition-colors border border-neutral-700 active:scale-95"
                                    >
                                        <Minus size={20} />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="Aumentar temperatura alvo"
                                        onClick={() => handleSetPointChange(0.5)}
                                        className="w-12 h-12 flex items-center justify-center rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white transition-colors border border-neutral-700 active:scale-95"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Set-Point</span>
                                    <span className="text-2xl font-mono text-green-500">{safeTargetTemp.toFixed(1)}°C</span>
                                </div>
                            </div>
                        </div>

                        {/* Humidity Display */}
                        <div className="flex flex-col items-center justify-center py-12 bg-neutral-900/20 border border-neutral-800 rounded-3xl relative overflow-hidden">
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-neutral-700 to-transparent opacity-50"></div>

                            <h2 className="text-neutral-500 font-bold uppercase tracking-[0.2em] text-sm mb-4">Umidade Relativa</h2>
                            <div className="flex items-start gap-2">
                                <span className="text-8xl md:text-8xl xl:text-9xl font-black text-white tracking-tighter tabular-nums">
                                    {safeHumidity !== undefined && safeHumidity !== null && !isNaN(parseFloat(String(safeHumidity))) ? parseFloat(String(safeHumidity)).toFixed(1) : '--'}
                                </span>
                                <span className="text-4xl text-neutral-600 font-light mt-4">%</span>
                            </div>
                        </div>
                    </div>

                    {/* Display Information Form - Only for Kegerator */}
                    {displayMode === DeviceMode.KEGERATOR && (
                        <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-8 backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-8">
                                <Monitor size={20} className="text-white" />
                                <h3 className="text-white font-bold uppercase tracking-widest text-sm">Editar Informações do Display</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                {/* Linha 1 */}
                                <div className="space-y-2">
                                    <label htmlFor="keg-line1-input" className="flex items-center justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                        Linha 1
                                        <span className="text-yellow-500/80 bg-yellow-500/10 px-2 py-0.5 rounded text-[9px] border border-yellow-500/20">AMARELO</span>
                                    </label>
                                    <input
                                        id="keg-line1-input"
                                        type="text"
                                        value={kegeratorForm.line1}
                                        onChange={(e) => handleKegeratorChange('line1', e.target.value)}
                                        className="w-full bg-black border border-neutral-800 text-white rounded-xl px-4 py-4 focus:outline-none focus:border-yellow-600/50 transition-colors text-lg font-mono placeholder-neutral-800"
                                        placeholder="LINHA 1..."
                                    />
                                </div>

                                {/* Linha 2 */}
                                <div className="space-y-2">
                                    <label htmlFor="keg-line2-input" className="flex items-center justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                        Linha 2
                                        <span className="text-yellow-500/80 bg-yellow-500/10 px-2 py-0.5 rounded text-[9px] border border-yellow-500/20">AMARELO</span>
                                    </label>
                                    <input
                                        id="keg-line2-input"
                                        type="text"
                                        value={kegeratorForm.line2}
                                        onChange={(e) => handleKegeratorChange('line2', e.target.value)}
                                        className="w-full bg-black border border-neutral-800 text-white rounded-xl px-4 py-4 focus:outline-none focus:border-yellow-600/50 transition-colors text-lg font-mono placeholder-neutral-800"
                                        placeholder="LINHA 2..."
                                    />
                                </div>

                                {/* Estilo */}
                                <div className="space-y-2">
                                    <label htmlFor="keg-style-input" className="flex items-center justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                        Estilo
                                        <span className="text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded text-[9px] border border-neutral-700">BRANCO</span>
                                    </label>
                                    <input
                                        id="keg-style-input"
                                        type="text"
                                        value={kegeratorForm.style}
                                        onChange={(e) => handleKegeratorChange('style', e.target.value)}
                                        className="w-full bg-black border border-neutral-800 text-white rounded-xl px-4 py-4 focus:outline-none focus:border-neutral-500 transition-colors text-lg font-mono placeholder-neutral-800"
                                        placeholder="EX: IPA..."
                                    />
                                </div>

                                {/* Cervejaria */}
                                <div className="space-y-2">
                                    <label htmlFor="keg-brewery-input" className="flex items-center justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                        Cervejaria
                                        <span className="text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded text-[9px] border border-neutral-700">BRANCO</span>
                                    </label>
                                    <input
                                        id="keg-brewery-input"
                                        type="text"
                                        value={kegeratorForm.brewery}
                                        onChange={(e) => handleKegeratorChange('brewery', e.target.value)}
                                        className="w-full bg-black border border-neutral-800 text-white rounded-xl px-4 py-4 focus:outline-none focus:border-neutral-500 transition-colors text-lg font-mono placeholder-neutral-800"
                                        placeholder="NOME DA CERVEJARIA..."
                                    />
                                </div>

                                {/* IBU */}
                                <div className="space-y-2">
                                    <label htmlFor="keg-ibu-input" className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">IBU</label>
                                    <input
                                        id="keg-ibu-input"
                                        type="number"
                                        value={isNaN(kegeratorForm.ibu) ? '' : kegeratorForm.ibu}
                                        onChange={(e) => handleKegeratorChange('ibu', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                        className="w-full bg-black border border-neutral-800 text-white rounded-xl px-4 py-4 focus:outline-none focus:border-neutral-500 transition-colors text-lg font-mono placeholder-neutral-800"
                                        placeholder="0"
                                    />
                                </div>

                                {/* ABV */}
                                <div className="space-y-2">
                                    <label htmlFor="keg-abv-input" className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">ABV %</label>
                                    <input
                                        id="keg-abv-input"
                                        type="number"
                                        step="0.1"
                                        value={isNaN(kegeratorForm.abv) ? '' : kegeratorForm.abv}
                                        onChange={(e) => handleKegeratorChange('abv', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                        className="w-full bg-black border border-neutral-800 text-white rounded-xl px-4 py-4 focus:outline-none focus:border-neutral-500 transition-colors text-lg font-mono placeholder-neutral-800"
                                        placeholder="0.0"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSaveKegerator}
                                className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-neutral-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                            >
                                <Save size={18} />
                                Atualizar Display
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                // === STANDARD FERMENTER MODE LAYOUT ===
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch animate-in fade-in duration-300 min-h-[600px]">

                    {/* Left Column: Forecasting & Charts */}
                    <div className="order-3 lg:order-1 lg:col-span-2 space-y-8 min-w-0 flex flex-col h-full">
                        {/* Forecasting Engine */}
                        {displayMode === DeviceMode.FERMENTER && (
                            <ForecastingEngine fermenter={fermenter} />
                        )}
                        <div className="flex-1">
                            <ErrorBoundary name="Gráfico de Temperatura">
                                <TemperatureChart
                                    data={fermenter.readings}
                                    events={fermenter.events}
                                    sensor1Name={fermenter.sensor1_name || 'Fermentador'}
                                    sensor2Name={fermenter.sensor2_name || 'Geladeira'}
                                />
                            </ErrorBoundary>
                        </div>

                        {displayMode === DeviceMode.FERMENTER && (
                            <>
                                <div className="flex-1">
                                    <ErrorBoundary name="Gráfico de Gravidade">
                                        <GravityChart 
                                            data={fermenter.readings} 
                                            og={fermenter.og} 
                                            fg={fermenter.fg} 
                                            events={fermenter.events} 
                                            sensorSgName={fermenter.sensor_sg_name || 'Gravidade (SG)'}
                                        />
                                    </ErrorBoundary>
                                </div>
                                <div className="flex-1">
                                    <ErrorBoundary name="Gráfico Duplo (Temp + Grav)">
                                        <DualAxisChart 
                                            data={fermenter.readings} 
                                            og={fermenter.og} 
                                            fg={fermenter.fg} 
                                            events={fermenter.events} 
                                            sensor1Name={fermenter.sensor1_name || 'Temperatura'}
                                            sensorSgName={fermenter.sensor_sg_name || 'Gravidade (SG)'}
                                        />
                                    </ErrorBoundary>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right Column: Metrics & Controls */}
                    <div className="order-2 lg:order-2 lg:col-span-1 flex flex-col gap-8 min-w-0 h-full">
                        {/* Telemetria Card */}
                        <div className="bg-neutral-900/40 rounded-3xl p-8 border border-neutral-800 backdrop-blur-sm relative overflow-hidden shrink-0">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Telemetria em Tempo Real</h3>
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                            </div>

                            <div className="space-y-6">
                                {/* Big Numbers */}
                                <div className="flex items-baseline justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-neutral-600 text-sm mb-1">
                                            Temperatura ({fermenter.sensor1_name || 'Mosto'})
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-4xl font-bold text-white font-mono">
                                                {safeCurrentTemp.toFixed(1)}
                                            </span>
                                            <span className="text-lg text-neutral-500">°C</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-neutral-600 text-sm mb-1">{fermenter.sensor_sg_name || 'Gravidade (SG)'}</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-4xl font-bold text-purple-400 font-mono">
                                                {safeCurrentGravity.toFixed(3)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed Grid - 4x2 */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-2 pt-6 border-t border-neutral-800/50">
                                    {/* Row 1 */}
                                    <div className="text-center">
                                        <Target size={16} className="text-neutral-600 mx-auto mb-2" />
                                        <span className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Set-point</span>
                                        <span className="block text-sm font-mono text-white">{safeTargetTemp.toFixed(1)}°</span>
                                    </div>
                                    <div className="text-center">
                                        <Snowflake size={16} className="text-neutral-600 mx-auto mb-2" />
                                        <span className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">{fermenter.sensor2_name || 'Geladeira'}</span>
                                        <span className="block text-sm font-mono text-blue-300">{safeCurrentFridgeTemp.toFixed(1)}°</span>
                                    </div>
                                    <div className="text-center">
                                        <Battery size={16} className="text-neutral-600 mx-auto mb-2" />
                                        <span className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Bateria</span>
                                        <span className={`block text-sm font-mono ${getBatteryColor(safeBattery)}`}>
                                            {safeBattery > 0 ? `${safeBattery.toFixed(2)}V` : '--'}
                                        </span>
                                    </div>
                                    <div className="text-center">
                                        <Clock size={16} className="text-neutral-600 mx-auto mb-2" />
                                        <span className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Fim Rampa</span>
                                        <span className="block text-sm font-mono text-white">{getStepTimeRemaining()}</span>
                                    </div>

                                    {/* Row 2 */}
                                    <div className="text-center">
                                        <ArrowDown size={16} className="text-neutral-600 mx-auto mb-2" />
                                        <span className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">OG</span>
                                        <span className="block text-sm font-mono text-white">{safeOG.toFixed(3)}</span>
                                    </div>
                                    <div className="text-center">
                                        <Target size={16} className="text-neutral-600 mx-auto mb-2" />
                                        <span className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Meta FG</span>
                                        <span className="block text-sm font-mono text-white">{safeFG ? safeFG.toFixed(3) : '-'}</span>
                                    </div>
                                    <div className="text-center">
                                        <Percent size={16} className="text-neutral-600 mx-auto mb-2" />
                                        <span className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Atenuação</span>
                                        <span className="block text-sm font-mono text-white">{currentAttenuation}%</span>
                                    </div>
                                    <div className="text-center">
                                        <FlaskConical size={16} className="text-neutral-600 mx-auto mb-2" />
                                        <span className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">ABV Est.</span>
                                        <span className="block text-sm font-mono text-white">{abv}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {displayMode === DeviceMode.FERMENTER && (
                            <div className="shrink-0">
                                {fermenter.batchId ? (
                                    <FermentationProfile
                                        steps={fermenter.profile || []}
                                        currentStepIndex={fermenter.currentStepIndex || 0}
                                        isPaused={fermenter.isPaused || false}
                                        startDate={fermenter.startDate}
                                        stepStartDate={fermenter.stepStartDate}
                                        stepTime={fermenter.currentDevice?.stepTime}
                                        lastUpdate={fermenter.currentDevice?.lastUpdate}
                                        style={fermenter.style}
                                        volume={fermenter.volume}
                                        og={safeOG}
                                        fg={safeFG ?? undefined}
                                        onUpdateSteps={handleUpdateSteps}
                                        onTogglePause={handleTogglePause}
                                        onPrevStep={handlePrevStep}
                                        onNextStep={handleNextStep}
                                        onFinishProfile={handleFinishProfile}
                                    />
                                ) : (
                                    <div className="bg-neutral-900/30 rounded-3xl p-6 border border-neutral-800 backdrop-blur-sm flex flex-col items-center justify-center text-center min-h-[200px]">
                                        <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-6">Perfil de Fermentação</h3>
                                            <p className="text-neutral-500 text-sm mb-4">Acesse a aba Fermentador para iniciar uma nova produção.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <FermentationTimeline 
                            events={fermenter.events || []} 
                            startDate={fermenter.startDate}
                            onAddEvent={handleAddEvent} 
                            onRemoveEvent={handleRemoveEvent} 
                        />

                        <GeminiAdvisor fermenter={fermenter} className="flex-1 min-h-[200px]" />
                    </div>
                </div>
            )}
            
            {/* Device Firmware & IP Info */}
            <div className="mt-8 mb-4 w-full animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
                <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-xl px-6 py-3 flex items-center justify-center gap-6 text-zinc-500 font-mono text-[10px] tracking-[0.15em] uppercase backdrop-blur-sm w-full">
                    <div className="flex items-center gap-2">
                        <span className="text-zinc-600 font-black">VER:</span>
                        <span className="text-zinc-400">{fermenter.currentDevice?.version || 'V0.0.000'}</span>
                    </div>
                    <span className="text-neutral-800 font-light opacity-50">//</span>
                    <div className="flex items-center gap-2">
                        <span className="text-zinc-600 font-black">IP:</span>
                        <span className="text-zinc-400">{fermenter.ipAddress || '0.0.0.0'}</span>
                    </div>
                    <span className="text-neutral-800 font-light opacity-50">//</span>
                    <div className="flex items-center gap-2 normal-case tracking-normal">
                        <WifiSignal rssi={fermenter.currentDevice?.rssi} />
                    </div>
                </div>
            </div>
        </div>
    );
};
