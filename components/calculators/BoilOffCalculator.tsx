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
        const totalTargetPoints = targetPoints * cVol; // If volume was kept same
        
        let extractNeeded = 0;
        let evapNeeded = 0;
        let diluteNeeded = 0;
        let boilTimeMins = 0;
        let isDilution = false;

        if (tGrav > cGrav) {
            // Need to ADD extract or EVAPORATE
            isDilution = false;
            
            // 1. Extract calculation
            const pointsDeficit = targetPoints - currentPoints; // Points per liter deficit
            const totalPointsNeeded = pointsDeficit * cVol; // Total points needed
            
            const ppg = extractPpg[extractType];
            const pointsPerKgL = ppg * 8.345404; // Conversion factor from ppg to pt*L/kg
            extractNeeded = (totalPointsNeeded / pointsPerKgL) * 1000; // in grams

            // 2. Evaporation calculation
            // Target Vol = Total Current Points / Target Points
            const targetVolForEvap = totalCurrentPoints / targetPoints;
            evapNeeded = cVol - targetVolForEvap;
            
            // 3. Boil time calculation
            if (calcBoil && !isNaN(boilRate) && boilRate > 0) {
                boilTimeMins = (evapNeeded / boilRate) * 60;
            }

        } else if (tGrav < cGrav) {
            // Need to DILUTE (Add water)
            isDilution = true;
            
            // Target Vol = Total Current Points / Target Points
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
            <div className="space-y-8">
                
                {/* Inputs Top Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {/* Current Grav */}
                    <div>
                        <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Densidade Atual</span>
                        <div className="relative">
                            <input 
                                type="number" step="0.001" value={currentGravInput} onChange={(e) => setCurrentGravInput(e.target.value)}
                                className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs">SG</span>
                        </div>
                    </div>
                    {/* Target Grav */}
                    <div>
                        <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Densidade Desejada</span>
                        <div className="relative">
                            <input 
                                type="number" step="0.001" value={targetGravInput} onChange={(e) => setTargetGravInput(e.target.value)}
                                className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs">SG</span>
                        </div>
                    </div>
                    {/* Current Vol */}
                    <div>
                        <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Volume Atual <span className="text-white">L</span></span>
                        <div className="relative">
                            <input 
                                type="number" step="1" value={currentVolInput} onChange={(e) => setCurrentVolInput(e.target.value)}
                                className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                            />
                        </div>
                    </div>
                    {/* Adição Dropdown */}
                    <div>
                        <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Adição</span>
                        <select 
                            value={extractType} onChange={(e) => setExtractType(e.target.value as any)} 
                            className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
                        >
                            <option value="DME" className="bg-neutral-900">Extrato de Malte Seco (DME)</option>
                            <option value="LME" className="bg-neutral-900">Extrato de Malte Líquido (LME)</option>
                            <option value="Sugar" className="bg-neutral-900">Açúcar de Mesa</option>
                        </select>
                    </div>
                </div>

                {/* Main Result Banner */}
                <div className="bg-neutral-800 rounded-lg p-5 border border-neutral-700">
                    <h3 className="text-xl text-white font-medium">
                        {results.isDilution ? (
                            <>Água para adicionar: <span className="font-bold">{results.diluteNeeded.toFixed(2)} L</span></>
                        ) : (
                            <>
                                {extractNames[extractType]} para adicionar: <span className="font-bold">{results.extractNeeded.toFixed(1)} g</span>
                                , ou evaporar: <span className="font-bold">{results.evapNeeded.toFixed(2)} L</span>
                            </>
                        )}
                    </h3>
                </div>

                {/* Correção da Fervura Section */}
                {!results.isDilution && (
                    <div className="pt-4 border-t border-neutral-800/50 space-y-4">
                        <span className="block text-xs font-bold text-neutral-500 mb-2">Correção da fervura</span>
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <label className="flex items-center gap-3 text-neutral-300 text-sm cursor-pointer select-none">
                                <input 
                                    type="checkbox" checked={calcBoil} onChange={(e) => setCalcBoil(e.target.checked)} 
                                    className="w-4 h-4 rounded bg-neutral-800 border-neutral-700 text-cyan-500 focus:ring-0" 
                                />
                                Calcular correção da fervura?
                            </label>

                            <div className="flex items-center gap-4">
                                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Evaporação</span>
                                <div className="relative w-24">
                                    <input 
                                        type="number" step="1" value={boilOffRateInput} onChange={(e) => setBoilOffRateInput(e.target.value)} disabled={!calcBoil}
                                        className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500 text-right"
                                    />
                                    <span className="absolute right-3 top-[-18px] text-neutral-500 font-bold text-[9px] uppercase pointer-events-none">L/hora</span>
                                </div>
                            </div>
                        </div>

                        {/* Boil Time Result Banner */}
                        {calcBoil && (
                            <div className="bg-neutral-800 rounded-lg p-5 border border-neutral-700">
                                <h3 className="text-xl text-white font-medium">
                                    Estender a fervura em <span className="font-bold">{results.boilTimeMins.toFixed(0)} minutos</span>
                                </h3>
                            </div>
                        )}
                    </div>
                )}

                <div className="text-center pt-8">
                     <p className="text-[10px] text-neutral-500 flex items-center justify-center gap-2 max-w-2xl mx-auto">
                        <span className="inline-block min-w-4 min-h-4 w-4 h-4 bg-neutral-700 text-neutral-300 rounded-full text-[9px] font-bold text-center leading-4">i</span>
                        Digite sua densidade atual, densidade desejada e volume para calcular quanto extrato você precisa adicionar, ou quanto você precisa diluir seu mosto para atingir a densidade desejada. Alternativamente, você pode calcular o quanto precisa alterar na duração de sua fervura para compensar.
                    </p>
                </div>

            </div>
        </div>
    );
};
