
import React, { useState } from 'react';
import { FermentationStep } from '../types';
import { Plus, Trash2, Clock, Thermometer, Edit2, Check, Play, Pause, SkipBack, SkipForward, Square } from 'lucide-react';

interface FermentationProfileProps {
    steps: FermentationStep[];
    currentStepIndex: number;
    isPaused: boolean;
    startDate?: string;
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

export const FermentationProfile: React.FC<FermentationProfileProps> = ({
    steps,
    currentStepIndex,
    isPaused,
    startDate,
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
    const [localSteps, setLocalSteps] = useState<FermentationStep[]>(steps);
    const [now, setNow] = useState(Date.now());

    // Keep local steps synced when not editing
    React.useEffect(() => {
        if (!isEditing) {
            setLocalSteps(steps);
        }
    }, [steps, isEditing]);

    // Tick the timer every second if fermentation is active
    React.useEffect(() => {
        if (!isPaused && startDate) {
            const interval = setInterval(() => {
                setNow(Date.now());
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isPaused, startDate]);

    const getStepTimeRemaining = (stepIndex: number) => {
        if (!startDate || localSteps.length === 0) return null;

        const start = new Date(startDate).getTime();
        let daysPrior = 0;

        // Sum previous steps
        for (let i = 0; i < stepIndex; i++) {
            daysPrior += localSteps[i].duration;
        }

        // Add current step duration to calculate target end time
        const currentDuration = localSteps[stepIndex]?.duration || 0;
        const targetEndTime = start + ((daysPrior + currentDuration) * 24 * 60 * 60 * 1000);
        const diff = targetEndTime - now;

        if (diff <= 0) return '0s';

        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((diff % (60 * 1000)) / 1000);

        if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
        if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
        if (minutes > 0) return `${minutes}m ${seconds}s`;
        return `${seconds}s`;
    };

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
        setLocalSteps(localSteps.filter(s => s.id !== id));
    };

    const handleChangeStep = (id: string, field: keyof FermentationStep, value: any) => {
        setLocalSteps(localSteps.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleToggleEdit = () => {
        if (isEditing) {
            // User finished editing, save to backend
            onUpdateSteps(localSteps);
        }
        setIsEditing(!isEditing);
    };

    const isLastStep = currentStepIndex >= localSteps.length - 1;

    return (
        <div className="bg-neutral-900/40 rounded-3xl p-8 border border-neutral-800 backdrop-blur-sm flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Perfil de Fermentação</h3>
                <button
                    onClick={handleToggleEdit}
                    className="text-neutral-400 hover:text-white transition-colors"
                >
                    {isEditing ? <Check size={16} className="text-green-500" /> : <Edit2 size={16} />}
                </button>
            </div>

            {/* Batch Info Summary */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8 pb-6 border-b border-neutral-800 text-sm font-medium text-neutral-400">
                {style && (
                    <span className="bg-white/10 text-neutral-200 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                        {style}
                    </span>
                )}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">Vol</span>
                    <span className="text-white">{volume}L</span>
                </div>
                {og && og > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">OG</span>
                        <span className="text-white">{og.toFixed(3)}</span>
                    </div>
                )}
                {fg && fg > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">FG</span>
                        <span className="text-white">{fg.toFixed(3)}</span>
                    </div>
                )}
            </div>

            <div className="space-y-3 relative mb-6">
                {/* Linha conectora vertical */}
                {localSteps.length > 0 && <div className="absolute left-[19px] top-4 bottom-4 w-px bg-neutral-800 z-0"></div>}

                {localSteps.map((step, index) => {
                    const isActive = index === currentStepIndex;
                    const isPast = index < currentStepIndex;

                    return (
                        <div
                            key={step.id}
                            className={`relative z-10 flex items-center gap-4 p-3 rounded-xl border transition-all duration-300 ${isActive
                                ? 'bg-neutral-800/80 border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.1)]' // Alterado de amber para white
                                : 'bg-black/40 border-neutral-800 hover:border-neutral-700'
                                } ${isPast ? 'opacity-40' : 'opacity-100'}`}
                        >
                            {/* Indicador de Status (Bolinha) */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border transition-colors ${isActive ? (isPaused ? 'bg-neutral-800 text-white border-white' : 'bg-white text-black border-white') : // Alterado de amber para white/black
                                isPast ? 'bg-neutral-800 text-neutral-500 border-neutral-700' :
                                    'bg-neutral-900 text-neutral-600 border-neutral-800'
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
                                        value={step.name}
                                        onChange={(e) => handleChangeStep(step.id, 'name', e.target.value)}
                                        className="bg-transparent border-b border-neutral-700 text-sm font-medium text-white w-full outline-none focus:border-neutral-500"
                                    />
                                ) : (
                                    <h4 className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-neutral-300'}`}>
                                        {step.name}
                                    </h4>
                                )}

                                <div className="flex items-center gap-4 mt-1">
                                    <div className="flex items-center gap-1.5" title="Temperatura Alvo">
                                        <Thermometer size={12} className="text-neutral-500" />
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={step.temperature}
                                                onChange={(e) => handleChangeStep(step.id, 'temperature', parseFloat(e.target.value))}
                                                className="bg-transparent text-xs font-mono text-neutral-300 w-10 border-b border-neutral-700 outline-none"
                                            />
                                        ) : (
                                            <span className="text-xs font-mono text-neutral-300">{step.temperature}°C</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5" title="Duração">
                                        <Clock size={12} className="text-neutral-500" />
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={step.duration}
                                                onChange={(e) => handleChangeStep(step.id, 'duration', parseFloat(e.target.value))}
                                                className="bg-transparent text-xs font-mono text-neutral-300 w-8 border-b border-neutral-700 outline-none"
                                            />
                                        ) : (
                                            <span className="text-xs font-mono text-neutral-300">{step.duration}d</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {isEditing && (
                                <button
                                    onClick={() => handleRemoveStep(step.id)}
                                    className="text-neutral-600 hover:text-red-500 transition-colors p-2"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}

                            {!isEditing && isActive && (
                                <div className="flex flex-col items-end gap-0.5">
                                    <div className={`${isPaused ? 'text-neutral-500' : 'text-white'} text-[10px] font-bold uppercase tracking-widest`}>
                                        {isPaused ? 'Pausado' : 'Ativo'}
                                    </div>
                                    {!isPaused && getStepTimeRemaining(index) && (
                                        <div className="text-neutral-400 text-xs font-mono">
                                            {getStepTimeRemaining(index)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {isEditing && (
                    <button
                        onClick={handleAddStep}
                        className="w-full py-3 rounded-xl border border-dashed border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600 hover:bg-neutral-900/50 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <Plus size={16} /> Adicionar Rampa
                    </button>
                )}
            </div>

            {/* Control Bar Footer */}
            {!isEditing && localSteps.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-auto pt-4 border-t border-neutral-800">
                    <button
                        onClick={onTogglePause}
                        className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all border ${isPaused
                            ? 'bg-neutral-800 text-neutral-400 border-neutral-700'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700'
                            }`}
                        title={isPaused ? "Retomar Fermentação" : "Pausar Rampa Atual"}
                    >
                        {isPaused ? <Play size={20} className="mb-1" /> : <Pause size={20} className="mb-1" />}
                        <span className="text-[10px] uppercase font-bold tracking-wider">{isPaused ? 'Retomar' : 'Pausar'}</span>
                    </button>

                    <button
                        onClick={onPrevStep}
                        disabled={currentStepIndex === 0}
                        className="flex flex-col items-center justify-center py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-800 text-white border border-neutral-700 transition-all"
                        title="Voltar para etapa anterior"
                    >
                        <SkipBack size={20} className="mb-1" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Anterior</span>
                    </button>

                    <button
                        onClick={onNextStep}
                        disabled={isLastStep}
                        className="flex flex-col items-center justify-center py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-800 text-white border border-neutral-700 transition-all"
                        title="Avançar para próxima rampa"
                    >
                        <SkipForward size={20} className="mb-1" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Próxima</span>
                    </button>

                    <button
                        onClick={onFinishProfile}
                        className="flex flex-col items-center justify-center py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-900/50 transition-all"
                        title="Encerrar Perfil e Fermentação"
                    >
                        <Square size={20} className="mb-1 fill-current" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Finalizar</span>
                    </button>
                </div>
            )}
        </div>
    );
};
