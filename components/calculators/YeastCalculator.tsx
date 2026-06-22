import React, { useState, useEffect } from 'react';
import { FlaskConical, Plus, Trash2 } from 'lucide-react';

interface StarterStage {
    id: string;
    sg: string;
    vol: string;
    auto: boolean;
}

interface StageResult {
    vol: number;
    dme: number;
    initialCells: number;
    newCells: number;
    pitchRateMml: number;
    growthFactor: number;
    lmeGrams: number;
}

export const YeastCalculator: React.FC = () => {
    const [ogSgInput, setOgSgInput] = useState<string>('1.051');
    const [volumeInput, setVolumeInput] = useState<string>('20');
    
    const [pitchRateSlider, setPitchRateSlider] = useState<number>(0.75);
    
    const [yeastType, setYeastType] = useState<'Líquida' | 'Seca'>('Líquida');
    const [cellsPerPack, setCellsPerPack] = useState<string>('100');
    
    const [calcViability, setCalcViability] = useState(true);
    const [purePitch, setPurePitch] = useState(false);
    const [mfgDate, setMfgDate] = useState<string>('');
    const [viability, setViability] = useState<string>('87');

    const [starterPacks, setStarterPacks] = useState<string>('1');
    const [stages, setStages] = useState<StarterStage[]>([
        { id: 'stage-1', sg: '1.036', vol: '0.8', auto: true }
    ]);

    const [results, setResults] = useState({
        targetCells: 0,
        cellsAvailable: 0,
        packsToUse: 0,
        packsToUseDecimal: 0,
        pitchRateMml: 0,
        difference: 0,
        
        starterNeeded: false,
        starterFinalCells: 0,
        starterDiff: 0,
        starterFinalPitchRate: 0,
        stageResults: [] as StageResult[]
    });

    const sgToPlato = (sg: number) => {
        return (-616.868) + (1111.14 * sg) - (630.272 * Math.pow(sg, 2)) + (135.997 * Math.pow(sg, 3));
    };

    useEffect(() => {
        const d = new Date();
        d.setDate(d.getDate() - 19);
        setMfgDate(d.toISOString().split('T')[0]);
    }, []);

    useEffect(() => {
        if (!calcViability || !mfgDate || yeastType === 'Seca') {
            if (yeastType === 'Seca' && calcViability) setViability('100');
            return;
        }
        const mfg = new Date(mfgDate);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - mfg.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const dropRate = purePitch ? 0.35 : 0.7;
        let v = 100 - (diffDays * dropRate);
        if (v < 0) v = 0;
        setViability(v.toFixed(0));
    }, [calcViability, mfgDate, purePitch, yeastType]);

    useEffect(() => {
        const og = parseFloat(ogSgInput.replace(',', '.'));
        const volL = parseFloat(volumeInput.replace(',', '.'));
        const pr = pitchRateSlider;
        const cpp = parseFloat(cellsPerPack.replace(',', '.'));
        const viab = parseFloat(viability.replace(',', '.')) / 100;
        const sPacks = parseFloat(starterPacks.replace(',', '.'));
        
        if (isNaN(og) || isNaN(volL) || isNaN(cpp) || isNaN(viab) || isNaN(sPacks)) return;

        const plato = sgToPlato(og);
        const targetCells = pr * (volL * 1000) * plato / 1000;
        
        const viableCellsPerPack = cpp * viab;
        const totalPacksNeededDecimal = targetCells / viableCellsPerPack;
        const totalPacksNeeded = Math.ceil(totalPacksNeededDecimal);
        const cellsAvailable = totalPacksNeeded * viableCellsPerPack;
        const diff = cellsAvailable - targetCells;
        const pitchRateMml = (cellsAvailable * 1000) / (volL * 1000);

        const initialStarterCells = sPacks * viableCellsPerPack;
        
        let currentCells = initialStarterCells;
        const newStageResults: StageResult[] = [];

        for (let i = 0; i < stages.length; i++) {
            const stage = stages[i];
            const sSg = parseFloat(stage.sg.replace(',', '.'));
            if (isNaN(sSg)) continue;

            const dmeGramsPerL = (sgToPlato(sSg) * sSg * 10);
            let sVol = parseFloat(stage.vol.replace(',', '.'));
            
            if (stage.auto && targetCells > currentCells) {
                const neededGrowth = targetCells - currentCells;
                const requiredDme = neededGrowth / 1.4;
                sVol = requiredDme / dmeGramsPerL;
                sVol = Math.ceil(sVol * 10) / 10;
            } else if (stage.auto) {
                sVol = 0;
            }

            if (isNaN(sVol)) sVol = 0;

            const sDme = sVol * dmeGramsPerL;
            const inoculationRate = sDme > 0 ? currentCells / sDme : 0;
            let yieldPerGram = 0;
            if (sDme > 0) {
                if (inoculationRate < 1.4) yieldPerGram = 1.4;
                else if (inoculationRate <= 3.5) yieldPerGram = 2.33 - 0.67 * inoculationRate;
                else yieldPerGram = 0;
            }

            const newCells = currentCells + (yieldPerGram * sDme);
            
            newStageResults.push({
                vol: sVol,
                dme: sDme,
                initialCells: currentCells,
                newCells: newCells,
                pitchRateMml: sVol > 0 ? (currentCells * 1000) / (sVol * 1000) : 0,
                growthFactor: currentCells > 0 ? newCells / currentCells : 0,
                lmeGrams: sDme * (44 / 36)
            });
            
            currentCells = newCells;
        }

        const starterDiff = currentCells - targetCells;
        const starterFinalPitchRate = (currentCells * 1000) / (volL * 1000);

        setResults({
            targetCells,
            cellsAvailable,
            packsToUse: totalPacksNeeded,
            packsToUseDecimal: totalPacksNeededDecimal,
            pitchRateMml,
            difference: diff,
            
            starterNeeded: targetCells > initialStarterCells,
            starterFinalCells: currentCells,
            starterDiff,
            starterFinalPitchRate,
            stageResults: newStageResults
        });

    }, [ogSgInput, volumeInput, pitchRateSlider, cellsPerPack, viability, starterPacks, stages]);

    const addStage = () => {
        setStages([
            ...stages, 
            { id: `stage-${Date.now()}`, sg: '1.036', vol: '1.0', auto: true }
        ]);
    };

    const removeStage = (id: string) => {
        if (stages.length <= 1) return;
        setStages(stages.filter(s => s.id !== id));
    };

    const updateStage = (id: string, field: keyof StarterStage, value: any) => {
        setStages(stages.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-neutral-800/50">
                <div className="p-4 bg-amber-400/10 rounded-2xl text-amber-400">
                    <FlaskConical size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tighter">Taxa de Inoculação / Starter</h2>
                    <p className="text-neutral-500 mt-1">Calcule sua levedura e dimensione a propagação em múltiplas etapas.</p>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                
                {/* Left Column: Direct Pitch */}
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        {/* OG SG */}
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Original Gravity</label>
                            <div className="relative">
                                <input 
                                    type="number" step="0.001" value={ogSgInput} onChange={(e) => setOgSgInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3.5 text-white font-mono text-lg focus:outline-none focus:border-amber-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">SG</span>
                            </div>
                        </div>

                        {/* Volume */}
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Volume do Lote</label>
                            <div className="relative">
                                <input 
                                    type="number" step="1" value={volumeInput} onChange={(e) => setVolumeInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3.5 text-white font-mono text-lg focus:outline-none focus:border-amber-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">L</span>
                            </div>
                        </div>
                    </div>

                    {/* Pitch Rate Slider */}
                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">Taxa de Inoculação</span>
                                <span className="text-sm text-amber-400 font-bold">{pitchRateSlider.toFixed(2)} <span className="text-neutral-500 font-normal ml-1">(M/ml/°P)</span></span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <input 
                                type="range" min="0.35" max="2.00" step="0.01" 
                                value={pitchRateSlider} onChange={(e) => setPitchRateSlider(parseFloat(e.target.value))}
                                className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                            <span className="text-xs text-white font-mono">{pitchRateSlider.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Levedura config */}
                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-6">
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Tipo</span>
                                <select 
                                    value={yeastType} onChange={(e) => setYeastType(e.target.value as any)} 
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
                                >
                                    <option className="bg-neutral-900">Líquida</option>
                                    <option className="bg-neutral-900">Seca</option>
                                </select>
                            </div>
                            <div>
                                <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Bilhões/pct</span>
                                <input 
                                    type="number" step="1" 
                                    value={cellsPerPack} onChange={(e) => setCellsPerPack(e.target.value)} 
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500" 
                                />
                            </div>
                        </div>

                        {/* Viabilidade */}
                        <div className="space-y-4 pt-2 border-t border-neutral-800/50">
                            <div className="flex gap-6">
                                <label className="flex items-center gap-2 text-neutral-300 text-sm cursor-pointer select-none">
                                    <input type="checkbox" checked={calcViability} onChange={(e) => setCalcViability(e.target.checked)} className="w-4 h-4 rounded bg-neutral-800 border-neutral-700 text-amber-500 focus:ring-0" />
                                    Calc. viabilidade
                                </label>
                                <label className="flex items-center gap-2 text-neutral-300 text-sm cursor-pointer select-none">
                                    <input type="checkbox" checked={purePitch} onChange={(e) => setPurePitch(e.target.checked)} className="w-4 h-4 rounded bg-neutral-800 border-neutral-700 text-amber-500 focus:ring-0" disabled={!calcViability} />
                                    PurePitch®
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Fabricação</span>
                                    <input type="date" value={mfgDate} onChange={(e) => setMfgDate(e.target.value)} disabled={!calcViability} className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500" />
                                </div>
                                <div className="relative">
                                    <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Viabilidade</span>
                                    <input type="number" value={viability} onChange={(e) => setViability(e.target.value)} disabled={calcViability} className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500" />
                                    <span className="absolute right-4 top-10 text-neutral-500 font-bold">%</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Result Card Left */}
                    <div className="bg-neutral-950 rounded-2xl p-6 border border-neutral-800/50 flex flex-col justify-center">
                        <div className="text-center mb-6">
                            <span className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Alvo de Inoculação</span>
                            <div className="text-5xl font-black text-amber-400 tracking-tighter">
                                {results.targetCells.toFixed(0)}<span className="text-2xl text-amber-400/50 ml-1">bi</span>
                            </div>
                        </div>

                        <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-neutral-400">Leveduras p/ usar:</span>
                                <span className="text-lg font-bold text-amber-400 font-mono">{results.packsToUse} pct <span className="text-xs text-neutral-500">({results.packsToUseDecimal.toFixed(1)})</span></span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-t border-neutral-800/50 text-[10px] text-neutral-400">
                                <span>Células Disponíveis</span>
                                <span className="font-mono text-white">{results.cellsAvailable.toFixed(0)} bi</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-t border-neutral-800/50 text-[10px] text-neutral-400">
                                <span>Diferença do Alvo</span>
                                <span className={`font-mono font-bold ${results.difference < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{results.difference > 0 ? '+' : ''}{results.difference.toFixed(0)} bi</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-t border-neutral-800/50 text-[10px] text-neutral-400">
                                <span>Pitch Rate Resultante</span>
                                <span className="font-mono text-white">{results.pitchRateMml.toFixed(1)} M/ml</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Starter */}
                <div className="space-y-6">

                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-6">
                        
                        {/* Propagação Config Inicial */}
                        <div className="grid grid-cols-2 gap-4 border-b border-neutral-800/50 pb-6">
                            <div>
                                <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Pct. Iniciais</span>
                                <div className="relative">
                                    <input type="number" step="1" value={starterPacks} onChange={(e) => setStarterPacks(e.target.value)} className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500" />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">pct</span>
                                </div>
                            </div>
                            <div>
                                <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Modelo de Propagação</span>
                                <select className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 appearance-none cursor-pointer">
                                    <option className="bg-neutral-900">Com Agitação (Braukaiser)</option>
                                    <option className="bg-neutral-900">Sem Agitação</option>
                                </select>
                            </div>
                        </div>

                        {/* Etapas Dinamicas */}
                        <div className="space-y-8">
                            {stages.map((stage, index) => {
                                const stageResult = results.stageResults[index];
                                return (
                                    <div key={stage.id} className="relative">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-amber-500 font-bold text-sm tracking-widest uppercase">Etapa {index + 1}</span>
                                            {stages.length > 1 && (
                                                <button 
                                                    onClick={() => removeStage(stage.id)}
                                                    className="text-neutral-500 hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>

                                        <label className="flex items-center gap-2 text-neutral-300 text-sm cursor-pointer select-none mb-4">
                                            <input type="checkbox" checked={stage.auto} onChange={(e) => updateStage(stage.id, 'auto', e.target.checked)} className="w-4 h-4 rounded bg-neutral-800 border-neutral-700 text-amber-500 focus:ring-0" />
                                            Calcular tamanho do starter
                                        </label>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Densidade</span>
                                                <div className="relative">
                                                    <input type="number" step="0.001" value={stage.sg} onChange={(e) => updateStage(stage.id, 'sg', e.target.value)} className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500" />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">SG</span>
                                                </div>
                                            </div>
                                            <div>
                                                <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Tamanho</span>
                                                <div className="relative">
                                                    <input 
                                                        type="number" step="0.1" 
                                                        value={stage.auto ? (stageResult ? stageResult.vol.toFixed(1) : '0.0') : stage.vol} 
                                                        onChange={(e) => { if (!stage.auto) updateStage(stage.id, 'vol', e.target.value); }} 
                                                        disabled={stage.auto} 
                                                        className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500" 
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">L</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Result per stage */}
                                        {stageResult && stageResult.vol > 0 && (
                                            <div className="mt-4 bg-neutral-900 rounded-xl p-4 border border-neutral-800/50">
                                                <h4 className="text-[#5a8b3d] font-bold text-sm mb-1">
                                                    {stageResult.vol.toFixed(1)} L <span className="text-neutral-300">starter c/ {stageResult.dme.toFixed(0)}g DME</span>
                                                </h4>
                                                <p className="text-white font-bold text-xs">Nova contagem: {stageResult.newCells.toFixed(0)} bi células</p>
                                                <div className="mt-2 text-[10px] text-neutral-500 space-y-0.5">
                                                    <p>Pitch Rate (Starter): {stageResult.pitchRateMml.toFixed(0)} M/ml</p>
                                                    <p>Fator de Crescimento: {stageResult.growthFactor.toFixed(2)}x</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        
                        {/* Botão Adicionar Etapa */}
                        <div className="pt-4 border-t border-neutral-800/50">
                            <button 
                                onClick={addStage}
                                className="w-full flex items-center justify-center gap-2 bg-neutral-900 text-amber-500 border border-neutral-700/50 px-4 py-3 text-xs font-bold rounded-xl hover:bg-neutral-800 transition-colors uppercase tracking-wider"
                            >
                                <Plus size={16} /> Adicionar Etapa de Propagação
                            </button>
                        </div>

                    </div>

                    {/* Result Card Right (Final) */}
                    <div className="bg-neutral-950 rounded-2xl p-6 border border-neutral-800/50 flex flex-col justify-center">
                        
                        {results.starterNeeded || !stages[0].auto ? (
                            <>
                                <div className="text-center mb-6">
                                    <span className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Contagem Final (Starter)</span>
                                    <div className="text-4xl font-black text-amber-400 tracking-tighter mb-2">
                                        {results.starterFinalCells.toFixed(0)}<span className="text-xl text-amber-400/50 ml-1">bi</span>
                                    </div>
                                </div>

                                <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
                                    <div className="flex justify-between items-center py-1 text-[10px] text-neutral-400">
                                        <span>Diferença do Alvo</span>
                                        <span className={`font-mono font-bold ${results.starterDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {results.starterDiff > 0 ? '+' : ''}{results.starterDiff.toFixed(0)} bi
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-t border-neutral-800/50 text-[10px] text-neutral-400">
                                        <span>Pitch Rate (Final do Lote)</span>
                                        <span className="font-mono text-white">{results.starterFinalPitchRate.toFixed(0)} M/ml</span>
                                    </div>
                                </div>
                                <div className="mt-4 text-[10px] text-neutral-600 text-center">
                                    O cálculo final compõe todas as {stages.length} etapas de propagação sucessivas.
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-10">
                                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-white font-bold mb-1">Pitch Rate Adequado</h3>
                                <p className="text-neutral-500 text-sm">Não é necessário propagar levedura. Você já possui células suficientes nos pacotes.</p>
                            </div>
                        )}
                        
                    </div>

                </div>

            </div>
        </div>
    );
};
