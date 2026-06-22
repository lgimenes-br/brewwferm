import React, { useState, useEffect } from 'react';
import { FlaskConical } from 'lucide-react';

export const YeastCalculator: React.FC = () => {
    const [volumeInput, setVolumeInput] = useState<string>('20');
    const [ogSgInput, setOgSgInput] = useState<string>('1.050');
    const [pitchRateInput, setPitchRateInput] = useState<string>('0.75');
    
    const [yeastType, setYeastType] = useState<'Liquid' | 'Dry'>('Dry');
    const [packCountInput, setPackCountInput] = useState<string>('1');

    const [results, setResults] = useState({
        targetCells: 0,
        currentCells: 0,
        shortfall: 0,
        starterVolume: 0,
        starterDme: 0,
        packsNeeded: 0
    });

    const sgToPlato = (sg: number) => {
        return (-616.868) + (1111.14 * sg) - (630.272 * Math.pow(sg, 2)) + (135.997 * Math.pow(sg, 3));
    };

    useEffect(() => {
        const volume = parseFloat(volumeInput.replace(',', '.'));
        const ogSg = parseFloat(ogSgInput.replace(',', '.'));
        const pitchRate = parseFloat(pitchRateInput.replace(',', '.'));
        const packCount = parseInt(packCountInput, 10);

        if (isNaN(volume) || isNaN(ogSg) || isNaN(pitchRate) || isNaN(packCount)) return;
        if (volume <= 0 || ogSg < 1) return;

        const plato = Math.max(0, sgToPlato(ogSg));
        const volumeMl = volume * 1000;

        // Target Cells in Billions
        // Rate (M cells / ml / °P) -> Target = Rate * 1,000,000 * volumeMl * Plato
        // In Billions: Target / 1,000,000,000
        const targetCells = (pitchRate * volumeMl * plato) / 1000;

        // Current Cells
        const cellsPerPack = yeastType === 'Liquid' ? 100 : 200; // Liquid ~100B, Dry ~200B
        const currentCells = packCount * cellsPerPack;

        const shortfall = targetCells - currentCells;
        
        // Starter Calculation (Simplified Stir Plate assumption: ~1.5B cells per ml of starter)
        let starterVolume = 0;
        let starterDme = 0;

        if (shortfall > 0) {
            starterVolume = shortfall / 1500; // in Liters
            starterDme = starterVolume * 100; // 100g of DME per Liter for ~1.036 SG
        }

        const packsNeeded = Math.ceil(targetCells / cellsPerPack);

        setResults({
            targetCells: Math.max(0, targetCells),
            currentCells: Math.max(0, currentCells),
            shortfall: Math.max(0, shortfall),
            starterVolume: Math.max(0, starterVolume),
            starterDme: Math.max(0, starterDme),
            packsNeeded: Math.max(1, packsNeeded)
        });

    }, [volumeInput, ogSgInput, pitchRateInput, yeastType, packCountInput]);

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-2xl max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-neutral-800/50">
                <div className="p-4 bg-amber-400/10 rounded-2xl text-amber-400">
                    <FlaskConical size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tighter">Taxa de Inoculação (Pitch Rate)</h2>
                    <p className="text-neutral-500 mt-1">Calcule a quantidade ideal de levedura e dimensione o seu Starter.</p>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                
                {/* Left Column: Inputs */}
                <div className="space-y-6">
                    
                    <div className="grid grid-cols-2 gap-4">
                        {/* Volume */}
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Volume do Lote</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    step="1"
                                    value={volumeInput}
                                    onChange={(e) => setVolumeInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3.5 text-white font-mono text-lg focus:outline-none focus:border-amber-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">L</span>
                            </div>
                        </div>

                        {/* OG */}
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Original Gravity</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    step="0.001"
                                    value={ogSgInput}
                                    onChange={(e) => setOgSgInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3.5 text-white font-mono text-lg focus:outline-none focus:border-amber-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">SG</span>
                            </div>
                        </div>
                    </div>

                    {/* Pitch Rate Select */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest">Perfil (Pitch Rate)</label>
                            <span className="text-[10px] text-neutral-500 font-mono">{pitchRateInput} M/ml/°P</span>
                        </div>
                        <select 
                            value={pitchRateInput}
                            onChange={(e) => setPitchRateInput(e.target.value)}
                            className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-amber-500 transition-colors cursor-pointer appearance-none"
                        >
                            <option value="0.50">0.50 - Ale (Fabricante Mínimo)</option>
                            <option value="0.75">0.75 - Ale (Recomendado Padrão)</option>
                            <option value="1.00">1.00 - Ale (High Gravity) / Hybrid</option>
                            <option value="1.50">1.50 - Lager (Recomendado Padrão)</option>
                            <option value="2.00">2.00 - Lager (High Gravity)</option>
                        </select>
                    </div>

                    {/* Yeast Type and Pack Count */}
                    <div className="p-5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-4">
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest">Sua Levedura Atual</label>
                        
                        <div className="flex gap-2 p-1 bg-neutral-900 border border-neutral-800 rounded-lg">
                            <button 
                                onClick={() => setYeastType('Dry')}
                                className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${yeastType === 'Dry' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                Seca (~200B)
                            </button>
                            <button 
                                onClick={() => setYeastType('Liquid')}
                                className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${yeastType === 'Liquid' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                Líquida (~100B)
                            </button>
                        </div>

                        <div className="flex items-center gap-4 pt-2">
                            <span className="text-sm text-neutral-400">Qtd. de Pacotes:</span>
                            <input 
                                type="number" 
                                min="1"
                                step="1"
                                value={packCountInput}
                                onChange={(e) => setPackCountInput(e.target.value)}
                                className="w-20 bg-neutral-800/50 border border-neutral-700 rounded-lg px-3 py-2 text-white font-mono text-center focus:outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column: Results */}
                <div className="bg-neutral-950 rounded-2xl p-6 border border-neutral-800/50 flex flex-col justify-between">
                    
                    {/* Main Target Result */}
                    <div className="text-center mb-6">
                        <span className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Células Necessárias</span>
                        <div className="text-6xl font-black text-amber-400 tracking-tighter">
                            {results.targetCells.toFixed(0)}<span className="text-2xl text-amber-400/50 ml-1">Bilhões</span>
                        </div>
                        <div className="text-xs text-neutral-500 mt-3">
                            Pacotes recomendados (sem starter): <span className="text-white font-bold">{results.packsNeeded} {yeastType === 'Dry' ? 'Seco(s)' : 'Líquido(s)'}</span>
                        </div>
                    </div>

                    {/* Starter Panel */}
                    <div className={`rounded-xl border transition-colors ${results.shortfall > 0 ? 'bg-amber-400/5 border-amber-500/30' : 'bg-emerald-400/5 border-emerald-500/30'} p-5`}>
                        {results.shortfall > 0 ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-amber-400 mb-2">
                                    <FlaskConical size={18} />
                                    <span className="text-sm font-bold uppercase tracking-widest">Yeast Starter Necessário</span>
                                </div>
                                <p className="text-xs text-neutral-400 leading-relaxed">
                                    Seus pacotes fornecem <strong className="text-white">{results.currentCells}B</strong> células. 
                                    Você tem um déficit de <strong className="text-white">{results.shortfall.toFixed(0)}B</strong> células.
                                </p>
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                                        <span className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1">Volume do Starter</span>
                                        <div className="text-lg font-bold text-white font-mono">{results.starterVolume.toFixed(2)} L</div>
                                    </div>
                                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                                        <span className="block text-[10px] text-neutral-500 uppercase tracking-widest mb-1">Extrato Seco (DME)</span>
                                        <div className="text-lg font-bold text-white font-mono">{results.starterDme.toFixed(0)} g</div>
                                    </div>
                                </div>
                                <span className="block text-[9px] text-neutral-600 mt-2">*Cálculo estimado considerando uso de Agitador Magnético (Stir Plate) e densidade do starter de ~1.036.</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center py-4">
                                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-3">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <span className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-1">Pitch Rate Adequado</span>
                                <p className="text-xs text-neutral-400">
                                    Seus pacotes ({results.currentCells}B células) são suficientes para esta brassagem. 
                                    Você não precisa fazer Starter.
                                </p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};
