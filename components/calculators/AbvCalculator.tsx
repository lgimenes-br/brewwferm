import React, { useState, useMemo } from 'react';

const sgToPlato = (sg: number) => {
    return (-616.868) + (1111.14 * sg) - (630.272 * Math.pow(sg, 2)) + (135.997 * Math.pow(sg, 3));
};
const platoToSg = (p: number) => {
    const denom = 258.6 - ((p / 258.2) * 227.1);
    return denom > 0 ? 1 + (p / denom) : 1.000;
};

export const AbvCalculator: React.FC = () => {
    const [unit, setUnit] = useState<'SG' | 'Plato' | 'Brix'>('SG');
    const [ogInput, setOgInput] = useState<string>('1.045');
    const [fgInput, setFgInput] = useState<string>('1.007');

    const results = useMemo(() => {
        let ogSg = 1.000;
        let fgSg = 1.000;

        const ogVal = parseFloat(ogInput.replace(',', '.'));
        const fgVal = parseFloat(fgInput.replace(',', '.'));

        if (isNaN(ogVal) || isNaN(fgVal)) {
            return {
                abv: 0, abw: 0, kcalPer100ml: 0, kjPer100ml: 0, carbsPer100ml: 0,
                appAttenuation: 0, realAttenuation: 0, oe: 0, ae: 0, re: 0
            };
        }

        if (unit === 'SG') {
            ogSg = ogVal > 200 ? ogVal / 1000 : ogVal;
            fgSg = fgVal > 200 ? fgVal / 1000 : fgVal;
        } else {
            ogSg = platoToSg(ogVal);
            fgSg = platoToSg(fgVal);
        }

        let abv = 0, abw = 0, kcalPer100ml = 0, kjPer100ml = 0, carbsPer100ml = 0;
        let appAttenuation = 0, realAttenuation = 0, oe = 0, ae = 0, re = 0;

        if (ogSg >= fgSg && ogSg > 1.000) {
            oe = sgToPlato(ogSg);
            ae = sgToPlato(fgSg);

            if (oe > 0 && (2.0665 - 0.010665 * oe) > 0) {
                // Real Extract (Balling's formula)
                re = (0.1808 * oe) + (0.8192 * ae);

                // ABV Standard
                abv = (ogSg - fgSg) * 131.25;

                // ABW
                abw = (oe - re) / (2.0665 - 0.010665 * oe);

                // Attenuation (using Plato for more accuracy like Brewfather)
                appAttenuation = ((oe - ae) / oe) * 100;
                realAttenuation = ((oe - re) / oe) * 100;

                // Calories (per 100ml)
                const kcalPer100g = (6.9 * abw) + 4.0 * (re - 0.1);
                kcalPer100ml = kcalPer100g * fgSg;
                kjPer100ml = kcalPer100ml * 4.184;

                // Carbohydrates (g per 100ml)
                carbsPer100ml = Math.max(0, (re - 0.1) * fgSg);
            }
        }

        return {
            abv: Math.max(0, abv),
            abw: Math.max(0, abw),
            kcalPer100ml: Math.max(0, kcalPer100ml),
            kjPer100ml: Math.max(0, kjPer100ml),
            carbsPer100ml: Math.max(0, carbsPer100ml),
            appAttenuation: Math.max(0, appAttenuation),
            realAttenuation: Math.max(0, realAttenuation),
            oe: Math.max(0, oe),
            ae: Math.max(0, ae),
            re: Math.max(0, re)
        };
    }, [ogInput, fgInput, unit]);

    const handleUnitToggle = (selectedUnit: 'SG' | 'Plato' | 'Brix') => {
        if (selectedUnit === unit) return;
        
        const currentOg = parseFloat(ogInput.replace(',', '.'));
        const currentFg = parseFloat(fgInput.replace(',', '.'));
        
        if (!isNaN(currentOg) && !isNaN(currentFg)) {
            if (selectedUnit === 'Plato' || selectedUnit === 'Brix') {
                if (unit === 'SG') {
                    const normOg = currentOg > 200 ? currentOg / 1000 : currentOg;
                    const normFg = currentFg > 200 ? currentFg / 1000 : currentFg;
                    setOgInput(Math.max(0, sgToPlato(normOg)).toFixed(1));
                    setFgInput(Math.max(0, sgToPlato(normFg)).toFixed(1));
                }
            } else {
                if (unit !== 'SG') {
                    setOgInput(Math.max(1, platoToSg(currentOg)).toFixed(3));
                    setFgInput(Math.max(1, platoToSg(currentFg)).toFixed(3));
                }
            }
        }
        setUnit(selectedUnit);
    };

    return (
        <div className="w-full">
            {/* Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                
                {/* Left Column: Inputs */}
                <div className="space-y-6">
                    {/* Unit Toggle */}
                    <div>
                        <span className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">Unidade de Medida</span>
                        <div className="flex bg-neutral-950 rounded-xl p-1 border border-neutral-800" role="group" aria-label="Unidade de medida">
                            <button 
                                type="button"
                                onClick={() => handleUnitToggle('SG')}
                                className={`flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-colors ${unit === 'SG' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                Gravidade (SG)
                            </button>
                            <button 
                                type="button"
                                onClick={() => handleUnitToggle('Plato')}
                                className={`flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-colors ${unit === 'Plato' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                Graus Plato (°P)
                            </button>
                            <button 
                                type="button"
                                onClick={() => handleUnitToggle('Brix')}
                                className={`flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-colors ${unit === 'Brix' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                Brix
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* OG */}
                        <div>
                            <label htmlFor="abv-og-input" className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Original Gravity (OG)</label>
                            <div className="relative">
                                <input 
                                    id="abv-og-input"
                                    type="number" 
                                    step={unit === 'SG' ? "0.001" : "0.1"}
                                    value={ogInput}
                                    onChange={(e) => setOgInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3.5 text-white font-mono text-lg focus:outline-none focus:border-blue-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">{unit === 'SG' ? 'SG' : (unit === 'Plato' ? '°P' : 'Bx')}</span>
                            </div>
                        </div>

                        {/* FG */}
                        <div>
                            <label htmlFor="abv-fg-input" className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Final Gravity (FG)</label>
                            <div className="relative">
                                <input 
                                    id="abv-fg-input"
                                    type="number" 
                                    step={unit === 'SG' ? "0.001" : "0.1"}
                                    value={fgInput}
                                    onChange={(e) => setFgInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3.5 text-white font-mono text-lg focus:outline-none focus:border-blue-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">{unit === 'SG' ? 'SG' : (unit === 'Plato' ? '°P' : 'Bx')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Results */}
                <div className="bg-neutral-950 rounded-2xl p-6 border border-neutral-800/50 flex flex-col justify-center gap-6">
                    
                    {/* Main ABV Result */}
                    <div className="text-center">
                        <span className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Álcool por Volume</span>
                        <div className="text-5xl font-black text-blue-400 tracking-tighter">
                            {results.abv.toFixed(1)}<span className="text-3xl text-blue-400/50">%</span>
                        </div>
                        <span className="block text-xs text-neutral-500 mt-2">Álcool por Peso (ABW) {results.abw.toFixed(1)}%</span>
                    </div>

                    {/* Extratos */}
                    <div className="grid grid-cols-3 gap-2 border-t border-b border-neutral-800/50 py-4">
                        <div className="text-center">
                            <span className="block text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Ext. Original</span>
                            <div className="text-sm font-bold text-white font-mono">{results.oe.toFixed(2)} °P</div>
                        </div>
                        <div className="text-center border-l border-r border-neutral-800/50 px-2">
                            <span className="block text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Ext. Aparente</span>
                            <div className="text-sm font-bold text-white font-mono">{results.ae.toFixed(2)} °P</div>
                        </div>
                        <div className="text-center">
                            <span className="block text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Ext. Real</span>
                            <div className="text-sm font-bold text-white font-mono">{results.re.toFixed(2)} °P</div>
                        </div>
                    </div>

                    {/* Outras Infos */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-neutral-900 rounded-xl p-3 border border-neutral-800 flex flex-col justify-center">
                            <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Calorias / Carb.</span>
                            <div className="text-sm font-medium text-amber-400">
                                {results.kcalPer100ml.toFixed(1)} <span className="text-xs text-neutral-500">kcal</span>
                            </div>
                            <div className="text-xs text-neutral-500 mt-0.5">
                                / {results.kjPer100ml.toFixed(1)} kJ
                            </div>
                            <div className="text-sm font-medium text-amber-400 mt-2">
                                {results.carbsPer100ml.toFixed(1)} <span className="text-xs text-neutral-500">g carb.</span>
                            </div>
                            <span className="text-[9px] text-neutral-600 block mt-1">(por 100ml)</span>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="bg-neutral-900 rounded-xl p-3 border border-neutral-800 flex-1 flex flex-col justify-center">
                                <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Aten. Aparente</span>
                                <div className="text-lg font-bold text-white font-mono leading-none">{results.appAttenuation.toFixed(1)}%</div>
                            </div>
                            <div className="bg-neutral-900 rounded-xl p-3 border border-neutral-800 flex-1 flex flex-col justify-center">
                                <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Aten. Real</span>
                                <div className="text-lg font-bold text-white font-mono leading-none">{results.realAttenuation.toFixed(1)}%</div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
