
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Fermenter, FermenterStatus, FermentationStep, DeviceMode, FermentationEvent, KegeratorConfig, EventType, normalizeGravity, formatGravity, isPlausibleGravity, isDeviceOnline, sensorView, otherSensors } from '../types';
import { Clock, Percent, FlaskConical, Battery, Target, ArrowDown, Monitor, Save, Plus, Minus, Edit2, Share2, Check, Thermometer, Droplets, Wifi, Cpu } from 'lucide-react';
import { TempDisplay, SmallValue, StatTile } from './app/AppUI';
import { generateBatchShareToken } from '../services/api';
import { BatchCharts } from './BatchCharts';
import { FermentationTimeline } from './FermentationTimeline';
import { ForecastingEngine } from './ForecastingEngine';
import { GeminiAdvisor } from './GeminiAdvisor';

/** Breww.AI fora do ar ate existir uma chave nova (a antiga vazou e o projeto do Google foi suspenso) */
const BREWW_AI_ENABLED = false;
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

    // Contas so com leitura plausivel: 32.949 (densimetro fora do liquido) daria "0%" falso
    const gravityOk = isPlausibleGravity(safeCurrentGravity);
    const abv = (safeOG > 0 && gravityOk)
        ? Math.max(0, (safeOG - safeCurrentGravity) * 131.25).toFixed(1)
        : '--';

    const currentAttenuation = (safeOG > 1.000 && gravityOk)
        ? Math.max(0, ((safeOG - safeCurrentGravity) / (safeOG - 1.000)) * 100).toFixed(0)
        : '--';

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

    const isIdleFermenter = displayMode === DeviceMode.FERMENTER && (!fermenter.batchId || fermenter.status === FermenterStatus.IDLE);
    const hasMappedSensors = Boolean((fermenter.currentDevice as any)?.macCtrl);
    const hasInvalidTemp = safeCurrentTemp <= -100 || safeCurrentTemp === 85;
    const shouldSuggestSensorScan = !hasMappedSensors || hasInvalidTemp;

    const isOnline = isDeviceOnline(fermenter);
    const statOp = String(fermenter.currentDevice?.statOp || '').toUpperCase();
    const state = !isOnline
        ? { label: 'Offline', caption: 'Os controles voltam quando ele reconectar', dot: 'var(--tertiary)' }
        : statOp === 'RESFRIANDO' ? { label: 'Resfriando', caption: 'Relé de frio ligado', dot: 'var(--accent)' }
        : statOp === 'AQUECENDO' ? { label: 'Aquecendo', caption: 'Relé de calor ligado', dot: 'var(--accent)' }
        : statOp.startsWith('DELAY') || statOp === 'AGUARDANDO' ? { label: 'Aguardando', caption: 'Protegendo o compressor', dot: 'var(--muted)' }
        : { label: 'Parado', caption: 'Relés desligados', dot: 'var(--muted)' };
    const modeName = (m?: DeviceMode | null) => m === DeviceMode.KEGERATOR ? 'Choppeira' : m === DeviceMode.FRIDGE ? 'Geladeira' : 'Fermentador';
    // Sem leitura (0,0 exato com o aparelho fora, ou erro do DS18B20) mostra "--"
    const readTemp = (v: number) => (!Number.isFinite(v) || hasInvalidTemp || (!isOnline && v === 0) ? undefined : v);
    // Sensores numerados: a temperatura grande e a do sensor que controla o modo; os outros so para ver
    const sv = sensorView(fermenter);
    const ctlRaw = sv.temps[sv.control];
    const ctlTemp = ctlRaw === undefined ? undefined : readTemp(ctlRaw);
    const others = otherSensors(sv).filter(o => isOnline || o.temp !== 0); // 0,0 com o aparelho fora = nunca leu
    const humidityNum = safeHumidity !== undefined && safeHumidity !== null ? parseFloat(String(safeHumidity)) : NaN;
    const step = fermenter.profile?.[fermenter.currentStepIndex || 0];
    const inputCls = 'w-full h-12 rounded-2xl bg-[var(--cell-2)] border border-[var(--line)] px-4 text-[16px] text-[var(--ink)] placeholder:text-[var(--tertiary)] focus:outline-none focus:border-[rgba(113,252,143,0.55)] transition-colors';

    const sensorSetupBanner = shouldSuggestSensorScan ? (
        <div className="app-row flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 mb-6">
            <span className="app-icon-btn text-[var(--accent)] shrink-0" aria-hidden><Thermometer size={18} /></span>
            <div className="flex-1 min-w-0">
                <h2 className="text-[16px] text-[var(--ink)]">Identifique os sensores</h2>
                <p className="text-[14px] text-[var(--muted)]">Descubra qual sensor está na cerveja e qual está na geladeira, para o controle medir no lugar certo.</p>
            </div>
            <button type="button" onClick={() => navigate(`/settings?device=${encodeURIComponent(fermenter.id)}&scan=1`)} className="app-btn-quiet shrink-0">
                Identificar sensores
            </button>
        </div>
    ) : null;

    const pendingModeBanner = hasPendingChange ? (
        <div className="app-row border-[rgba(113,252,143,0.3)] flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 mb-6" role="status">
            <div className="flex-1">
                <p className="text-[16px] text-[var(--ink)]">Mudar para {modeName(pendingMode)}?</p>
                <p className="text-[14px] text-[var(--muted)]">O aparelho passa a controlar a temperatura neste modo quando você confirmar.</p>
            </div>
            <div className="flex items-center gap-2">
                <button type="button" onClick={handleCancelMode} className="app-btn-quiet">Cancelar</button>
                <button type="button" onClick={handleActivateMode} className="app-btn">Mudar para {modeName(pendingMode)}</button>
            </div>
        </div>
    ) : null;

    const metaLine = (
        <p className="mt-10 text-center text-[13px] text-[var(--tertiary)] tabular">
            Firmware {fermenter.currentDevice?.version || '--'} · {fermenter.ipAddress || fermenter.id}
            {fermenter.currentDevice?.rssi ? ` · Wi-Fi ${fermenter.currentDevice.rssi} dBm` : ''}
        </p>
    );

    if (isIdleFermenter) {
        return (
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 pt-8 pb-16">
                {pendingModeBanner}
                {sensorSetupBanner}
                <FermentationWizard fermenter={fermenter} onStart={handleNewBatch} onCancel={() => navigate('/')} />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 pt-8 pb-16">
            <ConfirmDialog
                open={isFinishConfirmOpen}
                title="Finalizar o lote?"
                description="O lote vai para o histórico e o fermentador fica pronto para uma nova fermentação."
                confirmLabel="Finalizar lote"
                variant="warning"
                onConfirm={executeFinishProfile}
                onCancel={() => setIsFinishConfirmOpen(false)}
            />

            {/* Titulo: nome do lote (fermentador) ou do aparelho */}
            {displayMode === DeviceMode.FERMENTER ? (
                isEditingBatch ? (
                    <div className="app-card p-5 sm:p-6 mb-8 flex flex-col gap-4 max-w-2xl">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[13px] text-[var(--muted)]">Nome do lote</span>
                            <input type="text" value={editBeerName} onChange={(e) => setEditBeerName(e.target.value)} className={inputCls} placeholder="Ex.: Pilsen de outono" />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[13px] text-[var(--muted)]">OG</span>
                                <input type="number" step="0.001" value={isNaN(editOG) ? '' : editOG} onChange={(e) => setEditOG(parseFloat(e.target.value))} className={`${inputCls} tabular`} />
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[13px] text-[var(--muted)]">FG (alvo)</span>
                                <input type="number" step="0.001" value={isNaN(editFG) ? '' : editFG} onChange={(e) => setEditFG(parseFloat(e.target.value))} className={`${inputCls} tabular`} />
                            </label>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={handleSaveBatch} className="app-btn"><Save size={16} aria-hidden /> Salvar</button>
                            <button type="button" onClick={handleCancelBatchEdit} className="app-btn-quiet">Cancelar</button>
                        </div>
                    </div>
                ) : (
                    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h1 className="text-[40px] sm:text-[52px] leading-[1.04] font-light tracking-[-0.03em] text-[var(--ink)] truncate">{fermenter.beerName || 'Sem lote'}</h1>
                                {fermenter.batchId && (
                                    <button type="button" aria-label="Editar o lote" title="Editar o lote" onClick={() => setIsEditingBatch(true)} className="app-icon-btn !w-9 !h-9 text-[var(--muted)] shrink-0">
                                        <Edit2 size={15} aria-hidden />
                                    </button>
                                )}
                            </div>
                            <p className="mt-2 text-[16px] text-[var(--muted)]">
                                {[fermenter.name, fermenter.batchId ? `Lote ${fermenter.batchId}` : null, fermenter.volume ? `${fermenter.volume} L` : null].filter(Boolean).join(' · ')}
                            </p>
                        </div>
                        {fermenter.batchId && (
                            <button type="button" onClick={handleShareLiveBatch} className="app-btn-quiet shrink-0">
                                {isCopiedShare ? <Check size={16} className="text-[var(--accent)]" aria-hidden /> : <Share2 size={16} aria-hidden />}
                                {isCopiedShare ? 'Link copiado' : 'Compartilhar ao vivo'}
                            </button>
                        )}
                    </header>
                )
            ) : (
                <header className="mb-8">
                    <h1 className="text-[40px] sm:text-[52px] leading-[1.04] font-light tracking-[-0.03em] text-[var(--ink)] truncate">{fermenter.name}</h1>
                    <p className="mt-2 text-[16px] text-[var(--muted)]">
                        {displayMode === DeviceMode.KEGERATOR ? (fermenter.kegeratorConfig?.line1 ? `Choppeira · ${fermenter.kegeratorConfig.line1}` : 'Choppeira') : 'Geladeira'}
                    </p>
                </header>
            )}

            {pendingModeBanner}
            {sensorSetupBanner}

            {(displayMode === DeviceMode.KEGERATOR || displayMode === DeviceMode.FRIDGE) ? (
                // === CHOPPEIRA E GELADEIRA ===
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <section className="app-card lg:col-span-2 py-8 px-6 flex flex-col items-center gap-2" aria-label="Temperatura">
                            <span className="text-[15px] text-[var(--muted)]">{sv.names[sv.control]}</span>
                            <TempDisplay value={ctlTemp} size={116} dim={!isOnline} />
                        </section>
                        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                            <div className="app-card p-4 flex flex-col gap-2.5" role="group" aria-label={`Estado: ${state.label}`}>
                                <span className="flex items-center gap-2 text-[13px] text-[var(--muted)]"><span aria-hidden className="w-[7px] h-[7px] rounded-full" style={{ background: state.dot }} />Estado</span>
                                <span className="text-[26px] font-light text-[var(--ink)] leading-tight">{state.label}</span>
                                <span className="text-[12px] text-[var(--tertiary)]">{state.caption}</span>
                            </div>
                            <div className="app-card p-4 flex flex-col gap-2.5" style={{ opacity: isOnline ? 1 : 0.5 }}>
                                <span className="text-[13px] text-[var(--muted)]">Alvo</span>
                                <div className="flex items-center justify-between gap-2">
                                    <button type="button" aria-label="Diminuir a temperatura alvo" disabled={!isOnline} onClick={() => handleSetPointChange(-0.5)} className="app-icon-btn"><Minus size={17} aria-hidden /></button>
                                    <span aria-live="polite"><SmallValue value={safeTargetTemp.toFixed(1)} unit="°C" size={26} /></span>
                                    <button type="button" aria-label="Aumentar a temperatura alvo" disabled={!isOnline} onClick={() => handleSetPointChange(0.5)} className="app-icon-btn"><Plus size={17} aria-hidden /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Os outros sensores: so para ver (quem controla e a temperatura grande) */}
                        {others.map(o => <StatTile key={o.slot} label={o.name} value={o.temp.toFixed(1)} unit="°C" icon={<Thermometer size={14} />} />)}
                        <StatTile label="Umidade" value={Number.isFinite(humidityNum) ? humidityNum.toFixed(0) : '--'} unit="%" icon={<Droplets size={14} />} />
                        <StatTile label="Wi-Fi" value={fermenter.currentDevice?.rssi ? String(fermenter.currentDevice.rssi) : '--'} unit="dBm" icon={<Wifi size={14} />} />
                        <StatTile label="Firmware" value={fermenter.currentDevice?.version || '--'} icon={<Cpu size={14} />} />
                    </div>

                    {displayMode === DeviceMode.KEGERATOR && (
                        <section className="app-card p-5 sm:p-6 mt-2" aria-labelledby="keg-title">
                            <div className="flex items-center gap-3 mb-5">
                                <span className="app-icon-btn text-[var(--accent)]" aria-hidden><Monitor size={17} /></span>
                                <div>
                                    <h2 id="keg-title" className="text-[17px] text-[var(--ink)]">Texto da tela da choppeira</h2>
                                    <p className="text-[14px] text-[var(--muted)]">As duas primeiras linhas aparecem em amarelo; as outras, em branco.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {([
                                    ['line1', 'Linha 1', 'Ex.: IPA do quintal', 'text'],
                                    ['line2', 'Linha 2', 'Ex.: lote de outubro', 'text'],
                                    ['style', 'Estilo', 'Ex.: American IPA', 'text'],
                                    ['brewery', 'Cervejaria', 'Ex.: Cervejaria da garagem', 'text'],
                                ] as const).map(([k, label, ph]) => (
                                    <label key={k} className="flex flex-col gap-1.5">
                                        <span className="text-[13px] text-[var(--muted)]">{label}</span>
                                        <input type="text" value={(kegeratorForm as any)[k]} onChange={(e) => handleKegeratorChange(k, e.target.value)} className={inputCls} placeholder={ph} />
                                    </label>
                                ))}
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[13px] text-[var(--muted)]">IBU</span>
                                    <input type="number" value={isNaN(kegeratorForm.ibu) ? '' : kegeratorForm.ibu} onChange={(e) => handleKegeratorChange('ibu', e.target.value === '' ? 0 : parseFloat(e.target.value))} className={`${inputCls} tabular`} placeholder="0" />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[13px] text-[var(--muted)]">Álcool (%)</span>
                                    <input type="number" step="0.1" value={isNaN(kegeratorForm.abv) ? '' : kegeratorForm.abv} onChange={(e) => handleKegeratorChange('abv', e.target.value === '' ? 0 : parseFloat(e.target.value))} className={`${inputCls} tabular`} placeholder="0.0" />
                                </label>
                            </div>
                            <button type="button" onClick={handleSaveKegerator} className="app-btn mt-5"><Save size={16} aria-hidden /> Atualizar a tela</button>
                        </section>
                    )}
                    {metaLine}
                </div>
            ) : (
                // === FERMENTADOR ===
                <>
                    {/* Leitura principal: temperatura em destaque; estado, alvo, densidade e etapa ao lado */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <section className="app-card col-span-2 lg:row-span-2 py-8 px-6 flex flex-col items-center justify-center gap-2" aria-label="Temperatura da cerveja">
                            <span className="text-[15px] text-[var(--muted)]">{sv.names[sv.control]}</span>
                            <TempDisplay value={ctlTemp} size={116} dim={!isOnline} />
                            {hasInvalidTemp && <span className="text-[13px] text-[var(--danger)]">Sem leitura do sensor: aquecer e resfriar ficam desligados</span>}
                        </section>
                        <div className="app-card p-4 flex flex-col gap-2.5" role="group" aria-label={`Estado: ${state.label}. ${state.caption}`}>
                            <span className="flex items-center gap-2 text-[13px] text-[var(--muted)]"><span aria-hidden className="w-[7px] h-[7px] rounded-full" style={{ background: state.dot }} />Estado</span>
                            <span className="text-[26px] font-light text-[var(--ink)] leading-tight">{state.label}</span>
                            <span className="text-[12px] text-[var(--tertiary)]">{state.caption}</span>
                        </div>
                        <div className="app-card p-4 flex flex-col gap-2.5">
                            <span className="text-[13px] text-[var(--muted)]">Alvo da etapa</span>
                            <SmallValue value={safeTargetTemp.toFixed(1)} unit="°C" size={26} />
                            <span className="text-[12px] text-[var(--tertiary)]">{step ? `definido pelo perfil · ${step.name}` : 'definido pelo perfil'}</span>
                        </div>
                        <StatTile label={fermenter.sensor_sg_name || 'Densidade'} value={formatGravity(safeCurrentGravity)} caption={formatGravity(safeCurrentGravity) === '--' ? 'sem leitura do densímetro' : gravityOk ? 'densidade atual' : 'fora da faixa de mosto'} icon={<Droplets size={14} />} />
                        <StatTile label="Fim da etapa" value={getStepTimeRemaining()} caption={step ? step.name : undefined} icon={<Clock size={14} />} />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mt-3 sm:mt-4">
                        <StatTile label="OG" value={safeOG > 0 ? safeOG.toFixed(3) : '--'} caption="densidade inicial" icon={<ArrowDown size={14} />} />
                        <StatTile label="FG" value={safeFG ? safeFG.toFixed(3) : '--'} caption="densidade final (alvo)" icon={<Target size={14} />} />
                        <StatTile label="Atenuação" value={currentAttenuation} unit={currentAttenuation === '--' ? undefined : '%'} icon={<Percent size={14} />} />
                        <StatTile label="Álcool estimado" value={abv} unit={abv === '--' ? undefined : '%'} icon={<FlaskConical size={14} />} />
                        {others.map(o => <StatTile key={o.slot} label={o.name} value={o.temp.toFixed(1)} unit="°C" icon={<Thermometer size={14} />} />)}
                        <StatTile
                            label="Bateria do densímetro"
                            value={safeBattery > 0 ? safeBattery.toFixed(2) : '--'}
                            unit="V"
                            caption={safeBattery <= 0 ? 'sem leitura' : safeBattery > 3.9 ? 'carregada' : safeBattery > 3.5 ? 'média' : 'baixa, recarregue'}
                            warn={safeBattery > 0 && safeBattery <= 3.5}
                            icon={<Battery size={14} />}
                        />
                    </div>

                    {/* Graficos a esquerda; perfil, diario e analise a direita */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 mt-8 items-stretch">
                        <div className="order-2 lg:order-1 lg:col-span-2 flex flex-col gap-4 min-w-0">
                            <ForecastingEngine fermenter={fermenter} />
                            <ErrorBoundary name="Gráficos do lote">
                                <BatchCharts
                                    readings={fermenter.readings}
                                    events={fermenter.events}
                                    sensor1Name={sv.names[0]}
                                    sensor2Name={sv.names[1]}
                                    sensor3Name={sv.names[2]}
                                    sensor4Name={sv.names[3]}
                                    hidden={fermenter.chart_hidden}
                                    fg={safeFG ?? undefined}
                                    sensorSgName={fermenter.sensor_sg_name || 'Densidade'}
                                    live
                                    className="lg:flex-1"
                                />
                            </ErrorBoundary>
                        </div>
                        <div className="order-1 lg:order-2 flex flex-col gap-4 min-w-0">
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
                                <div className="app-card p-6 text-center text-[15px] text-[var(--muted)]">Nenhum perfil em andamento.</div>
                            )}
                            <FermentationTimeline events={fermenter.events || []} startDate={fermenter.startDate} onAddEvent={handleAddEvent} onRemoveEvent={handleRemoveEvent} />
                        </div>
                    </div>
                    {/* Breww.AI numa faixa propria, da largura toda (desligado por enquanto: ver AI_ENABLED no servidor) */}
                    {BREWW_AI_ENABLED && (
                        <div className="mt-4 lg:mt-5">
                            <GeminiAdvisor fermenter={fermenter} />
                        </div>
                    )}
                    {metaLine}
                </>
            )}
        </div>
    );
};
