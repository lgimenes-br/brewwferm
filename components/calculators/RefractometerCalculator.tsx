import React, { useState, useEffect } from 'react';
import { Pipette } from 'lucide-react';

export const RefractometerCalculator: React.FC = () => {
    const [isFermented, setIsFermented] = useState(true);
    const [wcfInput, setWcfInput] = useState<string>('1.00');
    const [ogSgInput, setOgSgInput] = useState<string>('1.045');
    const [brixWriInput, setBrixWriInput] = useState<string>('5.3');

    const [results, setResults] = useState({
        sg: 1.000,
        abv: 0,
        abw: 0
    });

    const sgToBrix = (sg: number) => {
        return (((135.997 * sg - 630.272) * sg + 1111.14) * sg - 616.868);
    };

    useEffect(() => {
        const ogSg = parseFloat(ogSgInput.replace(',', '.'));
        const brixWri = parseFloat(brixWriInput.replace(',', '.'));
        const wcf = parseFloat(wcfInput.replace(',', '.'));

        if (isNaN(brixWri) || isNaN(wcf) || wcf <= 0) return;

        let currentSg = 1.000;
        let abv = 0;
        let abw = 0;

        if (!isFermented) {
            // Unfermented wort
            const brix = brixWri / wcf;
            currentSg = 1 + (brix / (258.6 - ((brix / 258.2) * 227.1)));
        } else {
            // Fermented wort
            if (isNaN(ogSg) || ogSg < 1) return;

            const ogBrix = sgToBrix(ogSg) / wcf;
            const fgBrix = brixWri / wcf;

            // Sean Terrill's Formula
            currentSg = 1.0000 - 0.0044993 * ogBrix + 0.011774 * fgBrix 
                      + 0.00027581 * Math.pow(ogBrix, 2) - 0.0012717 * Math.pow(fgBrix, 2) 
                      - 0.00000728 * Math.pow(ogBrix, 3) + 0.000063293 * Math.pow(fgBrix, 3);

            // ABV Calculation
            if (ogSg > currentSg) {
                // Standard ABV
                const abvStd = (ogSg - currentSg) * 131.25;
                // Advanced ABV
                abv = (76.08 * (ogSg - currentSg) / (1.775 - ogSg)) * (currentSg / 0.794);
                // ABW
                abw = (0.79 * abv) / currentSg;
            }
        }

        setResults({
            sg: Math.max(1.000, currentSg),
            abv: Math.max(0, abv),
            abw: Math.max(0, abw)
        });

    }, [isFermented, ogSgInput, brixWriInput, wcfInput]);

    return (
        <div className="w-full">
            {/* Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                
                {/* Left Column: Inputs */}
                <div className="space-y-6">
                    {/* Toggle Fermentado */}
                    <div className="flex items-center justify-between p-4 bg-neutral-950 border border-neutral-800 rounded-xl cursor-pointer select-none" onClick={() => setIsFermented(!isFermented)}>
                        <div>
                            <span className="block text-sm font-bold text-white">Mosto Fermentado?</span>
                            <span className="text-xs text-neutral-500">Ative se a fermentação já começou</span>
                        </div>
                        <div className={`w-12 h-6 rounded-full transition-colors relative ${isFermented ? 'bg-emerald-500' : 'bg-neutral-800'}`}>
                            <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${isFermented ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* OG SG - Only if Fermented */}
                        {isFermented && (
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Densidade Original (OG)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        step="0.001"
                                        value={ogSgInput}
                                        onChange={(e) => setOgSgInput(e.target.value)}
                                        className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3.5 text-white font-mono text-lg focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">SG</span>
                                </div>
                            </div>
                        )}

                        {/* Current/FG Brix */}
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Brix WRI</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    step="0.1"
                                    value={brixWriInput}
                                    onChange={(e) => setBrixWriInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3.5 text-white font-mono text-lg focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">Bx</span>
                            </div>
                        </div>

                        {/* WCF */}
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Fator de Correção</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={wcfInput}
                                    onChange={(e) => setWcfInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3.5 text-white font-mono text-lg focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">WCF</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Results */}
                <div className="bg-neutral-950 rounded-2xl p-6 border border-neutral-800/50 flex flex-col justify-center">
                    
                    {/* Main FG Result */}
                    <div className="text-center mb-8">
                        <span className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Densidade Corrigida</span>
                        <div className="text-6xl font-black text-emerald-400 tracking-tighter font-mono">
                            {results.sg.toFixed(3)}
                        </div>
                    </div>

                    {/* Secondary Results */}
                    {isFermented && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
                                <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">ABV Estimado</span>
                                <div className="text-xl font-bold text-white font-mono">{results.abv.toFixed(2)}%</div>
                            </div>
                            <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
                                <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">ABW Estimado</span>
                                <div className="text-xl font-bold text-amber-400 font-mono">{results.abw.toFixed(2)}%</div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
