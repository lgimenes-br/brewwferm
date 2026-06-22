import React, { useState, useEffect } from 'react';
import { Droplets } from 'lucide-react';

export const BoilOffCalculator: React.FC = () => {
    const [unit, setUnit] = useState<'SG' | 'Plato'>('SG');
    
    const [currentVolInput, setCurrentVolInput] = useState<string>('25');
    const [currentGravInput, setCurrentGravInput] = useState<string>('1.040');
    
    const [targetType, setTargetType] = useState<'Volume' | 'Gravity'>('Gravity');
    const [targetInput, setTargetInput] = useState<string>('1.050');
    
    const [boilOffRateInput, setBoilOffRateInput] = useState<string>('3.5');

    const [results, setResults] = useState({
        finalVol: 0,
        finalGravSg: 1.000,
        finalGravPlato: 0,
        boilOffVol: 0,
        boilTimeMins: 0
    });

    // Helper conversions
    const sgToPlato = (sg: number) => {
        return (-616.868) + (1111.14 * sg) - (630.272 * Math.pow(sg, 2)) + (135.997 * Math.pow(sg, 3));
    };
    
    const platoToSg = (p: number) => 1 + (p / (258.6 - ((p / 258.2) * 227.1)));

    useEffect(() => {
        const cVol = parseFloat(currentVolInput.replace(',', '.'));
        const cGrav = parseFloat(currentGravInput.replace(',', '.'));
        const target = parseFloat(targetInput.replace(',', '.'));
        const boilRate = parseFloat(boilOffRateInput.replace(',', '.'));

        if (isNaN(cVol) || isNaN(cGrav) || isNaN(target) || isNaN(boilRate) || cVol <= 0 || target <= 0) return;

        let currentSg = 1.000;
        let currentPlato = 0;

        if (unit === 'SG') {
            currentSg = cGrav;
            currentPlato = sgToPlato(cGrav);
        } else {
            currentSg = platoToSg(cGrav);
            currentPlato = cGrav;
        }

        const points = (currentSg - 1) * 1000;
        const totalPoints = points * cVol;

        let finalVol = 0;
        let finalSg = 1.000;

        if (targetType === 'Volume') {
            finalVol = target;
            if (finalVol > 0) {
                const finalPoints = totalPoints / finalVol;
                finalSg = 1 + (finalPoints / 1000);
            }
        } else {
            // Target is Gravity
            let targetSg = 1.000;
            if (unit === 'SG') {
                targetSg = target;
            } else {
                targetSg = platoToSg(target);
            }
            
            const targetPoints = (targetSg - 1) * 1000;
            if (targetPoints > 0) {
                finalVol = totalPoints / targetPoints;
            }
            finalSg = targetSg;
        }

        const boilOffVol = cVol - finalVol;
        let boilTimeMins = 0;
        if (boilRate > 0 && boilOffVol > 0) {
            boilTimeMins = (boilOffVol / boilRate) * 60;
        }

        setResults({
            finalVol: Math.max(0, finalVol),
            finalGravSg: Math.max(1.000, finalSg),
            finalGravPlato: Math.max(0, sgToPlato(finalSg)),
            boilOffVol: boilOffVol,
            boilTimeMins: Math.max(0, boilTimeMins)
        });

    }, [currentVolInput, currentGravInput, targetType, targetInput, boilOffRateInput, unit]);

    const handleUnitToggle = (selectedUnit: 'SG' | 'Plato') => {
        if (selectedUnit === unit) return;
        
        const currentGrav = parseFloat(currentGravInput.replace(',', '.'));
        const tInput = parseFloat(targetInput.replace(',', '.'));
        
        if (!isNaN(currentGrav)) {
            if (selectedUnit === 'Plato') {
                setCurrentGravInput(Math.max(0, sgToPlato(currentGrav)).toFixed(1));
                if (targetType === 'Gravity' && !isNaN(tInput)) {
                    setTargetInput(Math.max(0, sgToPlato(tInput)).toFixed(1));
                }
            } else {
                setCurrentGravInput(Math.max(1, platoToSg(currentGrav)).toFixed(3));
                if (targetType === 'Gravity' && !isNaN(tInput)) {
                    setTargetInput(Math.max(1, platoToSg(tInput)).toFixed(3));
                }
            }
        }
        setUnit(selectedUnit);
    };

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-neutral-800/50">
                <div className="p-4 bg-cyan-400/10 rounded-2xl text-cyan-400">
                    <Droplets size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tighter">Correção de Densidade / Fervura</h2>
                    <p className="text-neutral-500 mt-1">Calcule a evaporação necessária para atingir a gravidade alvo (ou vice-versa).</p>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                
                {/* Left Column: Inputs */}
                <div className="space-y-6">
                    {/* Unit Toggle */}
                    <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">Unidade de Densidade</label>
                        <div className="flex bg-neutral-950 rounded-xl p-1 border border-neutral-800">
                            <button 
                                onClick={() => handleUnitToggle('SG')}
                                className={`flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-colors ${unit === 'SG' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                Gravidade (SG)
                            </button>
                            <button 
                                onClick={() => handleUnitToggle('Plato')}
                                className={`flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-colors ${unit === 'Plato' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                Graus Plato (°P)
                            </button>
                        </div>
                    </div>

                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-4">
                        <label className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1 border-b border-neutral-800/50 pb-2">Status Atual (Pré-Fervura)</label>
                        <div className="grid grid-cols-2 gap-4 pt-1">
                            {/* Current Vol */}
                            <div>
                                <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Volume Atual</span>
                                <div className="relative">
                                    <input 
                                        type="number" step="0.1" value={currentVolInput} onChange={(e) => setCurrentVolInput(e.target.value)}
                                        className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">L</span>
                                </div>
                            </div>
                            {/* Current Grav */}
                            <div>
                                <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Densidade Atual</span>
                                <div className="relative">
                                    <input 
                                        type="number" step={unit === 'SG' ? '0.001' : '0.1'} value={currentGravInput} onChange={(e) => setCurrentGravInput(e.target.value)}
                                        className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">{unit === 'SG' ? 'SG' : '°P'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-4">
                        <div className="flex justify-between items-center border-b border-neutral-800/50 pb-2 mb-1">
                            <label className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest">O que você quer calcular?</label>
                            <select 
                                value={targetType} onChange={(e) => setTargetType(e.target.value as any)} 
                                className="bg-transparent text-white text-[10px] font-bold uppercase tracking-wider focus:outline-none appearance-none cursor-pointer text-right"
                            >
                                <option value="Gravity" className="bg-neutral-900">Atingir Densidade Alvo</option>
                                <option value="Volume" className="bg-neutral-900">Atingir Volume Alvo</option>
                            </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">
                                    {targetType === 'Gravity' ? 'Densidade Alvo (Pós-Fervura)' : 'Volume Alvo (Pós-Fervura)'}
                                </span>
                                <div className="relative">
                                    <input 
                                        type="number" step={targetType === 'Gravity' && unit === 'SG' ? '0.001' : '0.1'} value={targetInput} onChange={(e) => setTargetInput(e.target.value)}
                                        className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">
                                        {targetType === 'Volume' ? 'L' : (unit === 'SG' ? 'SG' : '°P')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-neutral-800/50 pt-4 flex justify-between items-center">
                        <div>
                            <span className="block text-xs font-bold text-neutral-300">Taxa de Evaporação do Equipamento</span>
                            <span className="block text-[10px] text-neutral-500 mt-0.5">Usado para estimar o tempo de fervura</span>
                        </div>
                        <div className="relative w-28">
                            <input 
                                type="number" step="0.1" value={boilOffRateInput} onChange={(e) => setBoilOffRateInput(e.target.value)}
                                className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500 text-right"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs pointer-events-none">L/h</span>
                        </div>
                    </div>
                </div>

                {/* Right Column: Results */}
                <div className="bg-neutral-950 rounded-2xl p-6 border border-neutral-800/50 flex flex-col justify-center">
                    
                    {results.boilOffVol < 0 ? (
                        <div className="text-center py-10">
                            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Droplets size={32} />
                            </div>
                            <h3 className="text-white font-bold mb-1">Cálculo Inválido</h3>
                            <p className="text-neutral-500 text-sm">A densidade alvo deve ser maior que a atual, ou o volume alvo menor que o atual para haver evaporação.</p>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-8">
                                <span className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Volume Final Estimado</span>
                                <div className="text-6xl font-black text-cyan-400 tracking-tighter mb-2">
                                    {results.finalVol.toFixed(1)}<span className="text-2xl text-cyan-400/50 ml-1">L</span>
                                </div>
                                <div className="text-sm font-bold text-white">com densidade de {unit === 'SG' ? results.finalGravSg.toFixed(3) : results.finalGravPlato.toFixed(1)}{unit === 'SG' ? ' SG' : ' °P'}</div>
                            </div>

                            <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Resumo da Fervura</span>
                                </div>
                                
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center py-2 border-b border-neutral-800/50">
                                        <span className="text-sm text-neutral-300">Evaporação Necessária</span>
                                        <span className="font-mono font-bold text-cyan-400">{results.boilOffVol.toFixed(1)} L</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-neutral-800/50">
                                        <span className="text-sm text-neutral-300">Tempo de Fervura Estimado</span>
                                        <span className="font-mono font-bold text-amber-400">{results.boilTimeMins.toFixed(0)} mins</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2">
                                        <span className="text-sm text-neutral-300">Pontos de Gravidade Totais</span>
                                        <span className="font-mono text-white">{((results.finalGravSg - 1) * 1000 * results.finalVol).toFixed(0)} pts</span>
                                    </div>
                                </div>
                            </div>
                            
                            <p className="text-[10px] text-neutral-600 text-center mt-6">
                                Este cálculo assume que os açúcares não evaporam. Os pontos de gravidade totais do mosto permanecem constantes durante a fervura.
                            </p>
                        </>
                    )}
                </div>

            </div>
        </div>
    );
};
