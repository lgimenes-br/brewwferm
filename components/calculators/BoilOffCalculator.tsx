import React, { useState, useMemo } from 'react';

const EXTRACT_PPG: Record<'DME' | 'LME' | 'Sugar', number> = {
    'DME': 44,
    'LME': 36,
    'Sugar': 46
};

export const BoilOffCalculator: React.FC = () => {
    const [currentGravInput, setCurrentGravInput] = useState<string>('1.042');
    const [targetGravInput, setTargetGravInput] = useState<string>('1.050');
    const [currentVolInput, setCurrentVolInput] = useState<string>('24');
    
    const [extractType, setExtractType] = useState<'DME' | 'LME' | 'Sugar'>('DME');
    
    const [calcBoil, setCalcBoil] = useState(true);
    const [boilOffRateInput, setBoilOffRateInput] = useState<string>('10');

    const results = useMemo(() => {
        const rawCGrav = parseFloat(currentGravInput.replace(',', '.'));
        const rawTGrav = parseFloat(targetGravInput.replace(',', '.'));
        const cGrav = rawCGrav > 200 ? rawCGrav / 1000 : rawCGrav;
        const tGrav = rawTGrav > 200 ? rawTGrav / 1000 : rawTGrav;
        const cVol = parseFloat(currentVolInput.replace(',', '.'));
        const boilRate = parseFloat(boilOffRateInput.replace(',', '.'));

        if (isNaN(cGrav) || isNaN(tGrav) || isNaN(cVol) || cVol <= 0 || cGrav <= 1 || tGrav <= 1) {
            return {
                extractNeeded: 0,
                evapNeeded: 0,
                diluteNeeded: 0,
                boilTimeMins: 0,
                isDilution: false
            };
        }

        const currentPoints = (cGrav - 1) * 1000;
        const targetPoints = (tGrav - 1) * 1000;
        const totalCurrentPoints = currentPoints * cVol;
        
        let extractNeeded = 0;
        let evapNeeded = 0;
        let diluteNeeded = 0;
        let boilTimeMins = 0;
        let isDilution = false;

        if (tGrav > cGrav) {
            isDilution = false;
            const pointsDeficit = targetPoints - currentPoints; 
            const totalPointsNeeded = pointsDeficit * cVol; 
            
            const ppg = EXTRACT_PPG[extractType];
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

        return {
            extractNeeded: Math.max(0, extractNeeded),
            evapNeeded: Math.max(0, evapNeeded),
            diluteNeeded: Math.max(0, diluteNeeded),
            boilTimeMins: Math.max(0, boilTimeMins),
            isDilution
        };
    }, [currentGravInput, targetGravInput, currentVolInput, extractType, calcBoil, boilOffRateInput]);


    return (
        <div className="w-full">
            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                
                {/* Left Column: Inputs */}
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Current Grav */}
                        <div>
                            <label htmlFor="boil-current-grav" className="block text-[10px] text-[var(--muted)] font-bold mb-2">Densidade Atual</label>
                            <div className="relative">
                                <input 
                                    id="boil-current-grav"
                                    type="number" step="0.001" value={currentGravInput} onChange={(e) => setCurrentGravInput(e.target.value)}
                                    className="w-full bg-[var(--bg)] border border-black/15 rounded-xl px-4 py-3 text-[var(--ink)] font-mono text-lg focus:outline-none focus:border-cyan-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] font-bold text-xs">SG</span>
                            </div>
                        </div>

                        {/* Target Grav */}
                        <div>
                            <label htmlFor="boil-target-grav" className="block text-[10px] text-[var(--muted)] font-bold mb-2">Densidade Alvo</label>
                            <div className="relative">
                                <input 
                                    id="boil-target-grav"
                                    type="number" step="0.001" value={targetGravInput} onChange={(e) => setTargetGravInput(e.target.value)}
                                    className="w-full bg-[var(--bg)] border border-black/15 rounded-xl px-4 py-3 text-[var(--ink)] font-mono text-lg focus:outline-none focus:border-cyan-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] font-bold text-xs">SG</span>
                            </div>
                        </div>

                        {/* Current Vol */}
                        <div>
                            <label htmlFor="boil-current-vol" className="block text-[10px] text-[var(--muted)] font-bold mb-2">Volume Atual</label>
                            <div className="relative">
                                <input 
                                    id="boil-current-vol"
                                    type="number" step="1" value={currentVolInput} onChange={(e) => setCurrentVolInput(e.target.value)}
                                    className="w-full bg-[var(--bg)] border border-black/15 rounded-xl px-4 py-3 text-[var(--ink)] font-mono text-lg focus:outline-none focus:border-cyan-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] font-bold text-xs">L</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[var(--bg)] border border-black/[0.07] rounded-xl p-5 space-y-4">
                        <div>
                            <label htmlFor="boil-extract-type" className="block text-[10px] text-[var(--muted)] font-bold mb-2">Qual Adição Usar?</label>
                            <select 
                                id="boil-extract-type"
                                value={extractType} onChange={(e) => setExtractType(e.target.value as any)} 
                                className="w-full bg-[var(--bg)] border border-black/15 rounded-lg px-4 py-3 text-[var(--ink)] text-sm focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
                            >
                                <option value="DME" className="bg-white">Extrato de Malte Seco (DME)</option>
                                <option value="LME" className="bg-white">Extrato de Malte Líquido (LME)</option>
                                <option value="Sugar" className="bg-white">Açúcar de Mesa / Dextrose</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-[var(--bg)] border border-black/[0.07] rounded-xl p-5 space-y-6">
                        <label className="flex items-center gap-3 text-[#2b2f37] text-sm cursor-pointer select-none">
                            <input 
                                type="checkbox" checked={calcBoil} onChange={(e) => setCalcBoil(e.target.checked)} 
                                className="w-4 h-4 rounded bg-[var(--bg)] border-black/15 text-cyan-500 focus:ring-0" 
                            />
                            Calcular extensão da fervura?
                        </label>

                        <div>
                            <label htmlFor="boil-off-rate" className="block text-[10px] text-[var(--muted)] font-bold mb-2">Evaporação do Equipamento</label>
                            <div className="relative">
                                <input 
                                    id="boil-off-rate"
                                    type="number" step="1" value={boilOffRateInput} onChange={(e) => setBoilOffRateInput(e.target.value)} disabled={!calcBoil}
                                    className="w-full bg-[var(--bg)] border border-black/15 rounded-xl px-4 py-3 text-[var(--ink)] font-mono text-lg focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] font-bold text-xs ">L/hora</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Results */}
                <div className="bg-[var(--bg)] rounded-2xl p-6 border border-black/[0.07] flex flex-col justify-center">
                    
                    {results.isDilution ? (
                        <>
                            <div className="text-center mb-8">
                                <span className="block text-xs font-bold text-[var(--muted)] mb-2">Diluição Necessária</span>
                                <div className="text-6xl font-semibold text-cyan-700 tracking-tighter mb-2">
                                    +{results.diluteNeeded.toFixed(2)}<span className="text-2xl text-cyan-700/70 ml-1">L</span>
                                </div>
                                <div className="text-sm font-bold text-[var(--ink)]">de Água Purificada</div>
                            </div>

                            <div className="bg-white rounded-xl p-4 border border-black/[0.07] text-center">
                                <span className="block text-xs text-[var(--muted)]">
                                    Adicione essa quantidade de água para baixar a densidade de <strong>{currentGravInput}</strong> para <strong>{targetGravInput}</strong>.
                                </span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-center mb-6 border-b border-black/[0.07] pb-6">
                                <span className="block text-xs font-bold text-[var(--muted)] mb-2">Adição de {extractType}</span>
                                <div className="text-5xl font-semibold text-[#b45309] tracking-tighter mb-2">
                                    +{results.extractNeeded.toFixed(1)}<span className="text-2xl text-[#b45309]/70 ml-1">g</span>
                                </div>
                                <div className="text-[10px] text-[var(--muted)] font-bold">
                                    Para atingir {targetGravInput} sem ferver a mais
                                </div>
                            </div>

                            <div className="text-center mb-6">
                                <span className="block text-xs font-bold text-[var(--muted)] mb-2">OU: Evaporação por Fervura</span>
                                <div className="text-5xl font-semibold text-cyan-700 tracking-tighter mb-2">
                                    -{results.evapNeeded.toFixed(2)}<span className="text-2xl text-cyan-700/70 ml-1">L</span>
                                </div>
                                <div className="text-[10px] text-[var(--muted)] font-bold">
                                    Volume de água a ser evaporado
                                </div>
                            </div>

                            {calcBoil && (
                                <div className="bg-white rounded-xl p-4 border border-black/[0.07] text-center">
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-xs text-[var(--muted)] font-bold ">Estender a Fervura em</span>
                                        <span className="font-mono font-bold text-[var(--ink)] text-lg">+{results.boilTimeMins.toFixed(0)} mins</span>
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
