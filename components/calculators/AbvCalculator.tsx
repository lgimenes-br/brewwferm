import React, { useState, useEffect } from 'react';
import { Percent, ArrowRight } from 'lucide-react';

export const AbvCalculator: React.FC = () => {
    const [unit, setUnit] = useState<'SG' | 'Plato'>('SG');
    const [ogInput, setOgInput] = useState<string>('1.050');
    const [fgInput, setFgInput] = useState<string>('1.010');

    const [results, setResults] = useState({
        abvStandard: 0,
        abvAdvanced: 0,
        attenuation: 0,
        calories: 0
    });

    // Helper conversions
    const sgToPlato = (sg: number) => (-1 * 616.868) + (1111.14 * sg) - (630.272 * Math.pow(sg, 2)) + (135.997 * Math.pow(sg, 3));
    const platoToSg = (p: number) => 1 + (p / (258.6 - ((p / 258.2) * 227.1)));

    useEffect(() => {
        let ogSg = 1.000;
        let fgSg = 1.000;
        let ogPlato = 0;
        let fgPlato = 0;

        const ogVal = parseFloat(ogInput.replace(',', '.'));
        const fgVal = parseFloat(fgInput.replace(',', '.'));

        if (isNaN(ogVal) || isNaN(fgVal)) return;

        if (unit === 'SG') {
            ogSg = ogVal;
            fgSg = fgVal;
            ogPlato = sgToPlato(ogSg);
            fgPlato = sgToPlato(fgSg);
        } else {
            ogPlato = ogVal;
            fgPlato = fgVal;
            ogSg = platoToSg(ogPlato);
            fgSg = platoToSg(fgPlato);
        }

        // Only calculate if OG >= FG and OG > 1
        if (ogSg >= fgSg && ogSg > 1.000) {
            const abvStd = (ogSg - fgSg) * 131.25;
            const abvAdv = (76.08 * (ogSg - fgSg) / (1.775 - ogSg)) * (fgSg / 0.794);
            const attenuation = ((ogSg - fgSg) / (ogSg - 1)) * 100;

            // Calories formula per 12oz (approx 355ml)
            // Real Extract (RE)
            const re = (0.1808 * ogPlato) + (0.8192 * fgPlato);
            // Alcohol by weight
            const abw = (0.79 * abvStd) / fgSg;
            const calories = Math.max(0, 12 * ((6.9 * abw) + 4.0 * (re - 0.1)) * fgSg);

            setResults({
                abvStandard: Math.max(0, abvStd),
                abvAdvanced: Math.max(0, abvAdv),
                attenuation: Math.max(0, attenuation),
                calories: calories
            });
        } else {
            setResults({ abvStandard: 0, abvAdvanced: 0, attenuation: 0, calories: 0 });
        }
    }, [ogInput, fgInput, unit]);

    const handleUnitToggle = (selectedUnit: 'SG' | 'Plato') => {
        if (selectedUnit === unit) return;
        
        // Convert current inputs to new unit
        const currentOg = parseFloat(ogInput.replace(',', '.'));
        const currentFg = parseFloat(fgInput.replace(',', '.'));
        
        if (!isNaN(currentOg) && !isNaN(currentFg)) {
            if (selectedUnit === 'Plato') {
                setOgInput(Math.max(0, sgToPlato(currentOg)).toFixed(1));
                setFgInput(Math.max(0, sgToPlato(currentFg)).toFixed(1));
            } else {
                setOgInput(Math.max(1, platoToSg(currentOg)).toFixed(3));
                setFgInput(Math.max(1, platoToSg(currentFg)).toFixed(3));
            }
        }
        setUnit(selectedUnit);
    };

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-neutral-800/50">
                <div className="p-4 bg-blue-400/10 rounded-2xl text-blue-400">
                    <Percent size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tighter">Álcool / Atenuação / Calorias</h2>
                    <p className="text-neutral-500 mt-1">Estime o ABV, poder de atenuação e as calorias da sua cerveja.</p>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                
                {/* Left Column: Inputs */}
                <div className="space-y-6">
                    {/* Unit Toggle */}
                    <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">Unidade de Medida</label>
                        <div className="flex bg-neutral-950 rounded-xl p-1 border border-neutral-800">
                            <button 
                                onClick={() => handleUnitToggle('SG')}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${unit === 'SG' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                Gravidade (SG)
                            </button>
                            <button 
                                onClick={() => handleUnitToggle('Plato')}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${unit === 'Plato' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                Graus Plato (°P)
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* OG */}
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Original Gravity (OG)</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    step={unit === 'SG' ? "0.001" : "0.1"}
                                    value={ogInput}
                                    onChange={(e) => setOgInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3.5 text-white font-mono text-lg focus:outline-none focus:border-blue-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">{unit === 'SG' ? 'SG' : '°P'}</span>
                            </div>
                        </div>

                        {/* FG */}
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Final Gravity (FG)</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    step={unit === 'SG' ? "0.001" : "0.1"}
                                    value={fgInput}
                                    onChange={(e) => setFgInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3.5 text-white font-mono text-lg focus:outline-none focus:border-blue-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">{unit === 'SG' ? 'SG' : '°P'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Results */}
                <div className="bg-neutral-950 rounded-2xl p-6 border border-neutral-800/50 flex flex-col justify-center">
                    
                    {/* Main ABV Result */}
                    <div className="text-center mb-8">
                        <span className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">ABV (Padrão)</span>
                        <div className="text-6xl font-black text-blue-400 tracking-tighter">
                            {results.abvStandard.toFixed(1)}<span className="text-3xl text-blue-400/50">%</span>
                        </div>
                    </div>

                    {/* Secondary Results */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
                            <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">ABV (Avançado)</span>
                            <div className="text-xl font-bold text-white font-mono">{results.abvAdvanced.toFixed(2)}%</div>
                            <span className="text-[10px] text-neutral-600 block mt-1 leading-tight">Melhor para High Gravity</span>
                        </div>
                        <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
                            <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Atenuação Aparente</span>
                            <div className="text-xl font-bold text-white font-mono">{results.attenuation.toFixed(1)}%</div>
                        </div>
                        <div className="col-span-2 bg-neutral-900 rounded-xl p-4 border border-neutral-800 flex items-center justify-between px-6">
                            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">Calorias Estimadas</span>
                            <div className="text-lg font-bold text-amber-400 font-mono">
                                {results.calories.toFixed(0)} <span className="text-sm text-neutral-500 font-sans font-medium">kcal <span className="text-neutral-600">/ 355ml</span></span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
