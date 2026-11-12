
import React, { useState } from 'react';
import { FermentationStep, normalizeGravity } from '../types';
import { Plus, Trash2, Clock, Thermometer, Edit2, Check, Play, Pause, SkipBack, SkipForward, Square, FlaskConical } from 'lucide-react';

interface FermentationProfileProps {
    steps: FermentationStep[];
    currentStepIndex: number;
    isPaused: boolean;
    startDate?: string;
    stepStartDate?: string;
    stepTime?: number;
    lastUpdate?: string;
    style?: string;
    volume?: number;
    og?: number;
    fg?: number;
    onUpdateSteps: (newSteps: FermentationStep[]) => void;
    onTogglePause: () => void;
    onPrevStep: () => void;
    onNextStep: () => void;
    onFinishProfile: () => void;
}

interface StepCountdownProps {
    stepIndex: number;
    currentStepIndex: number;
    localSteps: FermentationStep[];
    startDate?: string;
    stepStartDate?: string;
    stepTime?: number;
    lastUpdate?: string;
}

const StepCountdown: React.FC<StepCountdownProps> = ({
    stepIndex,
    currentStepIndex,
    localSteps,
    startDate,
    stepStartDate,
    stepTime,
    lastUpdate
}) => {
    const [now, setNow] = useState(Date.now());
    const stabilizedStepStartRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        stabilizedStepStartRef.current = null;
    }, [currentStepIndex, stepStartDate]);

    React.useEffect(() => {
        if (startDate || stepStartDate || stepTime !== undefined) {
            const interval = setInterval(() => {
                if (typeof document === 'undefined' || !document.hidden) {
                    setNow(Date.now());
                }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [startDate, stepStartDate, stepTime]);

    if ((!startDate && !stepStartDate && stepTime === undefined) || localSteps.length === 0) return null;

    let targetEndTime = 0;
    const currentDuration = localSteps[stepIndex]?.duration || 0;

    if (stepIndex === currentStepIndex) {
        if (stepStartDate) {
            const dbStart = new Date(stepStartDate).getTime();
            if (!isNaN(dbStart)) {
                let useDbStart = true;
                if (stepTime !== undefined && lastUpdate) {
                    const elapsedMsAtLastUpdate = stepTime * 60 * 60 * 1000;
                    const absoluteStepStartTime = new Date(lastUpdate).getTime() - elapsedMsAtLastUpdate;
                    if (!isNaN(absoluteStepStartTime) && Math.abs(dbStart - absoluteStepStartTime) > 60 * 60 * 1000) {
                        useDbStart = false;
                        if (!stabilizedStepStartRef.current || Math.abs(stabilizedStepStartRef.current - absoluteStepStartTime) > 10 * 60 * 1000) {
                            stabilizedStepStartRef.current = absoluteStepStartTime;
                        }
                    }
                }
                const finalStart = useDbStart ? dbStart : (stabilizedStepStartRef.current || dbStart);
                targetEndTime = finalStart + (currentDuration * 24 * 60 * 60 * 1000);
            }
        } else if (stepTime !== undefined && lastUpdate) {
            const elapsedMsAtLastUpdate = stepTime * 60 * 60 * 1000;
            const absoluteStepStartTime = new Date(lastUpdate).getTime() - elapsedMsAtLastUpdate;
            if (!isNaN(absoluteStepStartTime)) {
                if (!stabilizedStepStartRef.current || Math.abs(stabilizedStepStartRef.current - absoluteStepStartTime) > 10 * 60 * 1000) {
                    stabilizedStepStartRef.current = absoluteStepStartTime;
                }
                const totalDurationMs = currentDuration * 24 * 60 * 60 * 1000;
                targetEndTime = stabilizedStepStartRef.current + totalDurationMs;
            }
        }
    }

    if ((targetEndTime === 0 || isNaN(targetEndTime)) && startDate) {
        const start = new Date(startDate).getTime();
        if (!isNaN(start)) {
            let daysPrior = 0;
            for (let i = 0; i < stepIndex; i++) {
                daysPrior += localSteps[i]?.duration || 0;
            }
            targetEndTime = start + ((daysPrior + currentDuration) * 24 * 60 * 60 * 1000);
        }
    }

    if (targetEndTime === 0 || isNaN(targetEndTime)) return null;

    const diff = targetEndTime - now;
    let formatted = '0s';
    if (diff > 0) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((diff % (60 * 1000)) / 1000);

        if (days > 0) formatted = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        else if (hours > 0) formatted = `${hours}h ${minutes}m ${seconds}s`;
        else if (minutes > 0) formatted = `${minutes}m ${seconds}s`;
        else formatted = `${seconds}s`;
    }

    return (
        <div className="text-[var(--muted)] text-xs font-mono tabular-nums">
            {formatted}
        </div>
    );
};

export const FermentationProfile: React.FC<FermentationProfileProps> = ({
    steps = [],
    currentStepIndex = 0,
    isPaused = false,
    startDate,
    stepStartDate,
    stepTime,
    lastUpdate,
    style,
    volume,
    og,
    fg,
    onUpdateSteps,
    onTogglePause,
    onPrevStep,
    onNextStep,
    onFinishProfile
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localSteps, setLocalSteps] = useState<FermentationStep[]>(() => Array.isArray(steps) ? steps : []);

    // Keep local steps synced when not editing
    React.useEffect(() => {
        if (!isEditing) {
            setLocalSteps(Array.isArray(steps) ? steps : []);
        }
    }, [steps, isEditing]);

    const handleAddStep = () => {
        const newStep: FermentationStep = {
            id: Math.random().toString(36).substr(2, 9),
            name: 'Nova Rampa',
            temperature: 18,
            duration: 1
        };
        setLocalSteps([...localSteps, newStep]);
    };

    const handleRemoveStep = (id: string) => {
        if (localSteps.length <= 1) return;
        setLocalSteps(localSteps.filter(s => s.id !== id));
    };

    const handleChangeStep = (id: string, field: keyof FermentationStep, value: any) => {
        setLocalSteps(localSteps.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleToggleEdit = () => {
        if (isEditing) {
            const sanitizedSteps = localSteps.map((s, idx) => {
                const parsedTrigger = normalizeGravity(s.triggerGravity, 0);
                const { triggerGravity, ...restStep } = s;
                return {
                    ...restStep,
                    name: (s.name || '').trim() || `Etapa ${idx + 1}`,
                    temperature: s.temperature === null || s.temperature === ('' as any) || isNaN(Number(s.temperature)) ? 18 : Number(s.temperature),
                    duration: isNaN(Number(s.duration)) || Number(s.duration) <= 0 ? 1 : Number(s.duration),
                    ...(parsedTrigger > 0 ? { triggerGravity: parsedTrigger } : {})
                };
            });
            setLocalSteps(sanitizedSteps);
            // User finished editing, save to backend
            onUpdateSteps(sanitizedSteps);
        }
        setIsEditing(!isEditing);
    };

    const isLastStep = currentStepIndex >= localSteps.length - 1;

    return (
        <div className="bg-white rounded-3xl p-8 border border-black/[0.07] backdrop-blur-sm flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-[var(--muted)] text-xs font-bold ">Perfil de Fermentação</h3>
                <button
                    type="button"
                    aria-label={isEditing ? 'Salvar perfil de fermentação' : 'Editar perfil de fermentação'}
                    title={isEditing ? 'Salvar perfil' : 'Editar perfil'}
                    onClick={handleToggleEdit}
                    className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                >
                    {isEditing ? <Check size={16} className="text-[#178a3f]" /> : <Edit2 size={16} />}
                </button>
            </div>

            {/* Batch Info Summary */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8 pb-6 border-b border-black/[0.07] text-sm font-medium text-[var(--muted)]">
                {style && (
                    <span className="bg-black/[0.06] text-[#2b2f37] px-3 py-1 rounded-md text-xs font-bold ">
                        {style}
                    </span>
                )}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-black/40 font-bold ">Vol</span>
                    <span className="text-[var(--ink)]">{volume}L</span>
                </div>
                {Number(og) > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-black/40 font-bold ">OG</span>
                        <span className="text-[var(--ink)]">{(Number(og) > 500 ? Number(og) / 1000 : Number(og)).toFixed(3)}</span>
                    </div>
                )}
                {Number(fg) > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-black/40 font-bold ">FG</span>
                        <span className="text-[var(--ink)]">{(Number(fg) > 500 ? Number(fg) / 1000 : Number(fg)).toFixed(3)}</span>
                    </div>
                )}
            </div>

            <div className="space-y-3 relative mb-6">
                {/* Linha conectora vertical */}
                {localSteps.length > 0 && <div className="absolute left-[19px] top-4 bottom-4 w-px bg-[var(--bg)] z-0"></div>}

                {localSteps.map((step, index) => {
                    const isActive = index === currentStepIndex;
                    const isPast = index < currentStepIndex;

                    return (
                        <div
                            key={step.id}
                            className={`relative z-10 flex items-center gap-4 p-3 rounded-xl border transition-all duration-300 ${isActive
                                ? 'bg-[var(--accent)]/15 border-[var(--ink)]/30'
                                : 'bg-[var(--bg)] border-black/[0.07] hover:border-black/15'
                                } ${isPast ? 'opacity-40' : 'opacity-100'}`}
                        >
                            {/* Indicador de Status (Bolinha) */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border transition-colors ${isActive ? (isPaused ? 'bg-[var(--bg)] text-[var(--ink)] border-[var(--ink)]' : 'bg-[var(--ink)] text-white border-[var(--ink)]') : // Alterado de amber para white/black
                                isPast ? 'bg-[var(--bg)] text-[var(--muted)] border-black/15' :
                                    'bg-white text-black/40 border-black/[0.07]'
                                }`}>
                                {isActive ? (
                                    isPaused ? <Pause size={18} /> : <Thermometer size={18} className="animate-pulse" />
                                ) : (
                                    <span className="text-xs font-mono">{index + 1}</span>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                {isEditing ? (
                                    <input
                                        type="text"
                                        aria-label={`Nome da etapa ${index + 1}`}
                                        value={step.name}
                                        onChange={(e) => handleChangeStep(step.id, 'name', e.target.value)}
                                        className="bg-transparent border-b border-black/15 text-sm font-medium text-[var(--ink)] w-full outline-none focus:border-black/30"
                                    />
                                ) : (
                                    <h4 title={step.name} className={`text-sm font-medium truncate ${isActive ? 'text-[var(--ink)]' : 'text-[#2b2f37]'}`}>
                                        {step.name}
                                    </h4>
                                )}

                                <div className="flex items-center gap-4 mt-1">
                                    <div className="flex items-center gap-1.5" title="Temperatura Alvo">
                                        <Thermometer size={12} className="text-[var(--muted)]" />
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                aria-label={`Temperatura da etapa ${step.name}`}
                                                value={isNaN(step.temperature) ? '' : step.temperature}
                                                onChange={(e) => handleChangeStep(step.id, 'temperature', parseFloat(e.target.value))}
                                                className="bg-transparent text-xs font-mono text-[#2b2f37] w-10 border-b border-black/15 outline-none"
                                            />
                                        ) : (
                                            <span className="text-xs font-mono text-[#2b2f37]">{step.temperature}°C</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5" title="Duração">
                                        <Clock size={12} className="text-[var(--muted)]" />
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                aria-label={`Duração em dias da etapa ${step.name}`}
                                                value={isNaN(step.duration) ? '' : step.duration}
                                                onChange={(e) => handleChangeStep(step.id, 'duration', parseFloat(e.target.value))}
                                                className="bg-transparent text-xs font-mono text-[#2b2f37] w-8 border-b border-black/15 outline-none"
                                            />
                                        ) : (
                                            <span className="text-xs font-mono text-[#2b2f37]">{step.duration}d</span>
                                        )}
                                    </div>
                                    {(isEditing || (step.triggerGravity !== undefined && step.triggerGravity > 0)) && (
                                        <div className="flex items-center gap-1.5" title="Gatilho de Densidade (Avança automaticamente ao atingir esta SG)">
                                            <FlaskConical size={12} className="text-purple-600" />
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    placeholder="SG alvo"
                                                    aria-label={`Meta SG ${step.name}`}
                                                    value={step.triggerGravity !== undefined && !isNaN(step.triggerGravity) ? step.triggerGravity : ''}
                                                    onChange={(e) => handleChangeStep(step.id, 'triggerGravity', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                                    className="bg-transparent text-xs font-mono text-purple-700 w-16 border-b border-black/15 outline-none focus:border-purple-500"
                                                />
                                            ) : (
                                                <span className="text-[11px] font-mono text-purple-700 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                                                    ≤ {Number(step.triggerGravity).toFixed(3)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {isEditing && localSteps.length > 1 && (
                                <button
                                    type="button"
                                    aria-label={`Remover etapa ${step.name}`}
                                    title="Remover etapa"
                                    onClick={() => handleRemoveStep(step.id)}
                                    className="text-black/40 hover:text-[#d63a4d] transition-colors p-2"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}

                            {!isEditing && isActive && (
                                <div className="flex flex-col items-end gap-0.5">
                                    <div className={`${isPaused ? 'text-[var(--muted)]' : 'text-[var(--ink)]'} text-[10px] font-bold `}>
                                        {isPaused ? 'Pausado' : 'Ativo'}
                                    </div>
                                    {!isPaused && (
                                        <StepCountdown
                                            stepIndex={index}
                                            currentStepIndex={currentStepIndex}
                                            localSteps={localSteps}
                                            startDate={startDate}
                                            stepStartDate={stepStartDate}
                                            stepTime={stepTime}
                                            lastUpdate={lastUpdate}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {isEditing && (
                    <button
                        onClick={handleAddStep}
                        className="w-full py-3 rounded-xl border border-dashed border-black/[0.07] text-[var(--muted)] hover:text-[var(--ink)] hover:border-black/25 hover:bg-white transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <Plus size={16} /> Adicionar Rampa
                    </button>
                )}
            </div>

            {/* Control Bar Footer */}
            {!isEditing && (
                <div className="grid grid-cols-4 gap-2 mt-auto pt-4 border-t border-black/[0.07]">
                    <button
                        onClick={onTogglePause}
                        disabled={localSteps.length === 0}
                        className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all border ${isPaused
                            ? 'bg-[var(--bg)] text-[var(--muted)] border-black/15'
                            : 'bg-[var(--bg)] hover:bg-black/10 text-[var(--ink)] border-black/15'
                            } disabled:opacity-30`}
                        title={isPaused ? "Retomar Fermentação" : "Pausar Rampa Atual"}
                    >
                        {isPaused ? <Play size={20} className="mb-1" /> : <Pause size={20} className="mb-1" />}
                        <span className="text-[10px] font-bold ">{isPaused ? 'Retomar' : 'Pausar'}</span>
                    </button>

                    <button
                        onClick={onPrevStep}
                        disabled={currentStepIndex === 0 || localSteps.length === 0}
                        className="flex flex-col items-center justify-center py-3 rounded-xl bg-[var(--bg)] hover:bg-black/10 disabled:opacity-30 disabled:hover:bg-[var(--bg)] text-[var(--ink)] border border-black/15 transition-all"
                        title="Voltar para etapa anterior"
                    >
                        <SkipBack size={20} className="mb-1" />
                        <span className="text-[10px] font-bold ">Anterior</span>
                    </button>

                    <button
                        onClick={onNextStep}
                        disabled={isLastStep || localSteps.length === 0}
                        className="flex flex-col items-center justify-center py-3 rounded-xl bg-[var(--bg)] hover:bg-black/10 disabled:opacity-30 disabled:hover:bg-[var(--bg)] text-[var(--ink)] border border-black/15 transition-all"
                        title="Avançar para próxima rampa"
                    >
                        <SkipForward size={20} className="mb-1" />
                        <span className="text-[10px] font-bold ">Próxima</span>
                    </button>

                    <button
                        onClick={onFinishProfile}
                        className="flex flex-col items-center justify-center py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-[#d63a4d] border border-red-200 transition-all"
                        title="Encerrar Perfil e Fermentação"
                    >
                        <Square size={20} className="mb-1 fill-current" />
                        <span className="text-[10px] font-bold ">Finalizar</span>
                    </button>
                </div>
            )}
        </div>
    );
};
