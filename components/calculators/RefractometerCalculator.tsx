import React, { useState, useEffect } from 'react';
import { Pipette } from 'lucide-react';

export const RefractometerCalculator: React.FC = () => {
    const [wcfInput, setWcfInput] = useState<string>('1.04');
    const [ogBrixInput, setOgBrixInput] = useState<string>('12.4');
    const [fgBrixInput, setFgBrixInput] = useState<string>('6.0');

    const [results, setResults] = useState({
        originalSg: 1.000,
        correctedFg: 1.000,
        abv: 0
    });

    useEffect(() => {
        const wcf = parseFloat(wcfInput.replace(',', '.'));
        const ogBrix = parseFloat(ogBrixInput.replace(',', '.'));
        const fgBrix = parseFloat(fgBrixInput.replace(',', '.'));

        if (isNaN(wcf) || isNaN(ogBrix) || wcf <= 0) return;

        // Corrected Original Brix
        const ogi = ogBrix / wcf;

        // Unfermented Wort SG
        const originalSg = 1 + (ogi / (258.6 - ((ogi / 258.2) * 227.1)));

        let correctedFg = originalSg;
        let abv = 0;

        if (!isNaN(fgBrix) && fgBrix > 0) {
            // Sean Terrill's Formula
            correctedFg = 1.0000 - 0.0044993 * ogi + 0.011774 * fgBrix + 0.00027581 * Math.pow(ogi, 2) - 0.0012717 * Math.pow(fgBrix, 2) - 0.00000728 * Math.pow(ogi, 3) + 0.000063293 * Math.pow(fgBrix, 3);
            
            // ABV
            abv = (originalSg - correctedFg) * 131.25;
        }

        setResults({
            originalSg: Math.max(1.000, originalSg),
            correctedFg: Math.max(1.000, correctedFg),
            abv: Math.max(0, abv)
        });

    }, [wcfInput, ogBrixInput, fgBrixInput]);

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-neutral-800/50">
                <div className="p-4 bg-emerald-400/10 rounded-2xl text-emerald-400">
                    <Pipette size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tighter">Correção do Refratômetro</h2>
                    <p className="text-neutral-500 mt-1">Ajuste as leituras em Brix compensando a presença de álcool.</p>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                
                {/* Left Column: Inputs */}
                <div className="space-y-6">
                    {/* WCF */}
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest">Wort Correction Factor</label>
                            <span className="text-xs text-neutral-600">Padrão: 1.04</span>
                        </div>
                        <input 
                            type="number" 
                            step="0.01"
                            value={wcfInput}
                            onChange={(e) => setWcfInput(e.target.value)}
                            className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3.5 text-white font-mono text-lg focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* OG Brix */}
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Original Brix</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    step="0.1"
                                    value={ogBrixInput}
                                    onChange={(e) => setOgBrixInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3.5 text-white font-mono text-lg focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">Bx</span>
                            </div>
                        </div>

                        {/* Current/FG Brix */}
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Brix Atual</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    step="0.1"
                                    value={fgBrixInput}
                                    onChange={(e) => setFgBrixInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3.5 text-white font-mono text-lg focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">Bx</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Results */}
                <div className="bg-neutral-950 rounded-2xl p-6 border border-neutral-800/50 flex flex-col justify-center">
                    
                    {/* Main FG Result */}
                    <div className="text-center mb-8">
                        <span className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">FG Corrigida (SG)</span>
                        <div className="text-6xl font-black text-emerald-400 tracking-tighter font-mono">
                            {results.correctedFg.toFixed(3)}
                        </div>
                        <span className="text-[11px] text-neutral-600 block mt-2 font-mono uppercase tracking-widest">Fórmula: Sean Terrill</span>
                    </div>

                    {/* Secondary Results */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
                            <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">OG Estimada</span>
                            <div className="text-xl font-bold text-white font-mono">{results.originalSg.toFixed(3)}</div>
                        </div>
                        <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
                            <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">ABV Estimado</span>
                            <div className="text-xl font-bold text-amber-400 font-mono">{results.abv.toFixed(1)}%</div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
