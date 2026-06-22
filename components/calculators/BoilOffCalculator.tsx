import React, { useState, useEffect } from 'react';
import { Droplets } from 'lucide-react';

export const BoilOffCalculator: React.FC = () => {
    const [currentGravInput, setCurrentGravInput] = useState<string>('1.042');
    const [targetGravInput, setTargetGravInput] = useState<string>('1.050');
    const [currentVolInput, setCurrentVolInput] = useState<string>('24');
    
    const [extractType, setExtractType] = useState<'DME' | 'LME' | 'Sugar'>('DME');
    
    const [calcBoil, setCalcBoil] = useState(true);
    const [boilOffRateInput, setBoilOffRateInput] = useState<string>('10');

    const [results, setResults] = useState({
        extractNeeded: 0,
        evapNeeded: 0,
        diluteNeeded: 0,
        boilTimeMins: 0,
        isDilution: false
    });

    const extractPpg = {
        'DME': 44,
        'LME': 36,
        'Sugar': 46
    };

    const extractNames = {
        'DME': 'Extrato de Malte Seco (DME)',
        'LME': 'Extrato de Malte Líquido (LME)',
        'Sugar': 'Açúcar de Mesa / Dextrose'
    };

    useEffect(() => {
        const cGrav = parseFloat(currentGravInput.replace(',', '.'));
        const tGrav = parseFloat(targetGravInput.replace(',', '.'));
        const cVol = parseFloat(currentVolInput.replace(',', '.'));
        const boilRate = parseFloat(boilOffRateInput.replace(',', '.'));

        if (isNaN(cGrav) || isNaN(tGrav) || isNaN(cVol) || cVol <= 0 || cGrav < 1 || tGrav < 1) return;

        const currentPoints = (cGrav - 1) * 1000;
        const targetPoints = (tGrav - 1) * 1000;
        const totalCurrentPoints = currentPoints * cVol;
        const totalTargetPoints = targetPoints * cVol; 
        
        let extractNeeded = 0;
        let evapNeeded = 0;
        let diluteNeeded = 0;
        let boilTimeMins = 0;
        let isDilution = false;

        if (tGrav > cGrav) {
            isDilution = false;
            const pointsDeficit = targetPoints - currentPoints; 
            const totalPointsNeeded = pointsDeficit * cVol; 
            
            const ppg = extractPpg[extractType];
            const pointsPerKgL = ppg * 8.345404; 
            extractNeeded = (totalPointsNeeded / pointsPerKgL) * 1000; 

            const targetVolForEvap = totalCurrentPoints / targetPoints;
            evapNeeded = cVol - targetVolForEvap;
            
            if (calcBoil && !isNaN(boilRate) && boilRate > 0) {
                boilTimeMins = (evapNeeded / boilRate) * 60;
            }
        } else if (tGrav < cGrav) {
            isDilution = true;
            const targetVolForDilute = totalCurrentPoints / targetPoints;
            diluteNeeded = targetVolForDilute - cVol;
        }

        setResults({
            extractNeeded: Math.max(0, extractNeeded),
            evapNeeded: Math.max(0, evapNeeded),
            diluteNeeded: Math.max(0, diluteNeeded),
            boilTimeMins: Math.max(0, boilTimeMins),
            isDilution
        });

    }, [currentGravInput, targetGravInput, currentVolInput, extractType, calcBoil, boilOffRateInput]);


    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-neutral-800/50">
                <div className="p-4 bg-cyan-400/10 rounded-2xl text-cyan-400">
                    <Droplets size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tighter">Correção da Densidade / Evaporação</h2>
                    <p className="text-neutral-500 mt-1">Calcule adições, diluições e tempos de fervura para bater seu alvo.</p>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                
                {/* Left Column: Inputs */}
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Current Grav */}
                        <div>
                            <label className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Densidade Atual</label>
                            <div className="relative">
                                <input 
                                    type="number" step="0.001" value={currentGravInput} onChange={(e) => setCurrentGravInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-cyan-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs">SG</span>
                            </div>
                        </div>

                        {/* Target Grav */}
                        <div>
                            <label className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Densidade Alvo</label>
                            <div className="relative">
                                <input 
                                    type="number" step="0.001" value={targetGravInput} onChange={(e) => setTargetGravInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-cyan-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs">SG</span>
                            </div>
                        </div>

                        {/* Current Vol */}
                        <div>
                            <label className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Volume Atual</label>
                            <div className="relative">
                                <input 
                                    type="number" step="1" value={currentVolInput} onChange={(e) => setCurrentVolInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-cyan-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs">L</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-4">
                        <div>
                            <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Qual Adição Usar?</span>
                            <select 
                                value={extractType} onChange={(e) => setExtractType(e.target.value as any)} 
                                className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
                            >
                                <option value="DME" className="bg-neutral-900">Extrato de Malte Seco (DME)</option>
                                <option value="LME" className="bg-neutral-900">Extrato de Malte Líquido (LME)</option>
                                <option value="Sugar" className="bg-neutral-900">Açúcar de Mesa / Dextrose</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-6">
                        <label className="flex items-center gap-3 text-neutral-300 text-sm cursor-pointer select-none">
                            <input 
                                type="checkbox" checked={calcBoil} onChange={(e) => setCalcBoil(e.target.checked)} 
                                className="w-4 h-4 rounded bg-neutral-800 border-neutral-700 text-cyan-500 focus:ring-0" 
                            />
                            Calcular extensão da fervura?
                        </label>

                        <div>
                            <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Evaporação do Equipamento</span>
                            <div className="relative">
                                <input 
                                    type="number" step="1" value={boilOffRateInput} onChange={(e) => setBoilOffRateInput(e.target.value)} disabled={!calcBoil}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs uppercase">L/hora</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Results */}
                <div className="bg-neutral-950 rounded-2xl p-6 border border-neutral-800/50 flex flex-col justify-center">
                    
                    {results.isDilution ? (
                        <>
                            <div className="text-center mb-8">
                                <span className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Diluição Necessária</span>
                                <div className="text-6xl font-black text-cyan-400 tracking-tighter mb-2">
                                    +{results.diluteNeeded.toFixed(2)}<span className="text-2xl text-cyan-400/50 ml-1">L</span>
                                </div>
                                <div className="text-sm font-bold text-white">de Água Purificada</div>
                            </div>

                            <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
                                <span className="block text-xs text-neutral-400">
                                    Adicione essa quantidade de água para baixar a densidade de <strong>{currentGravInput}</strong> para <strong>{targetGravInput}</strong>.
                                </span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-center mb-6 border-b border-neutral-800/50 pb-6">
                                <span className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Adição de {extractType}</span>
                                <div className="text-5xl font-black text-amber-400 tracking-tighter mb-2">
                                    +{results.extractNeeded.toFixed(1)}<span className="text-2xl text-amber-400/50 ml-1">g</span>
                                </div>
                                <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">
                                    Para atingir {targetGravInput} sem ferver a mais
                                </div>
                            </div>

                            <div className="text-center mb-6">
                                <span className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">OU: Evaporação por Fervura</span>
                                <div className="text-5xl font-black text-cyan-400 tracking-tighter mb-2">
                                    -{results.evapNeeded.toFixed(2)}<span className="text-2xl text-cyan-400/50 ml-1">L</span>
                                </div>
                                <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">
                                    Volume de água a ser evaporado
                                </div>
                            </div>

                            {calcBoil && (
                                <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-xs text-neutral-400 font-bold uppercase tracking-widest">Estender a Fervura em</span>
                                        <span className="font-mono font-bold text-white text-lg">+{results.boilTimeMins.toFixed(0)} mins</span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                </div>

            </div>
        </div>
    );
};
