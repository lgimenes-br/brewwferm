import React, { useState, useEffect } from 'react';
import { Wind } from 'lucide-react';

export const CarbonationCalculator: React.FC = () => {
    const [styleInput, setStyleInput] = useState<string>('American IPA');
    const [co2VolInput, setCo2VolInput] = useState<string>('2.4');
    const [tempInput, setTempInput] = useState<string>('4');
    const [typeInput, setTypeInput] = useState<'Keg (Forçado)' | 'Priming (Açúcar)'>('Keg (Forçado)');
    
    const [batchVolInput, setBatchVolInput] = useState<string>('20');
    const [fermTempInput, setFermTempInput] = useState<string>('20');

    const [results, setResults] = useState({
        pressureBar: 0,
        pressurePsi: 0,
        sugarGrams: 0,
        residualCo2: 0
    });

    const beerStyles = [
        { name: 'Altbier', min: 2.2, max: 2.6 },
        { name: 'Amber Kellerbier', min: 2.2, max: 2.7 },
        { name: 'American Amber Ale', min: 2.2, max: 2.8 },
        { name: 'American Barleywine', min: 1.6, max: 2.2 },
        { name: 'American Brown Ale', min: 2.0, max: 2.5 },
        { name: 'American IPA', min: 2.4, max: 2.9 },
        { name: 'American Lager', min: 2.5, max: 2.8 },
        { name: 'American Light Lager', min: 2.5, max: 2.8 },
        { name: 'American Pale Ale', min: 2.2, max: 2.8 },
        { name: 'American Porter', min: 1.8, max: 2.5 },
        { name: 'American Stout', min: 2.2, max: 2.6 },
        { name: 'American Strong Ale', min: 2.2, max: 2.7 },
        { name: 'American Wheat Beer', min: 2.3, max: 2.6 },
        { name: 'Australian Sparkling Ale', min: 2.4, max: 3.0 },
        { name: 'Baltic Porter', min: 2.0, max: 2.6 },
        { name: 'Belgian Blond Ale', min: 2.2, max: 2.8 },
        { name: 'Belgian Dark Strong Ale', min: 2.2, max: 2.8 },
        { name: 'Belgian IPA', min: 2.2, max: 2.8 },
        { name: 'Belgian Pale Ale', min: 2.2, max: 2.7 },
        { name: 'Belgian Tripel', min: 2.4, max: 3.0 },
        { name: 'Berliner Weisse', min: 3.4, max: 3.5 },
        { name: 'Best Bitter', min: 0.8, max: 1.3 },
        { name: 'Bière de Garde', min: 2.2, max: 2.8 },
        { name: 'Black IPA', min: 2.2, max: 2.8 },
        { name: 'Blonde Ale', min: 2.3, max: 2.6 },
        { name: 'British Brown Ale', min: 1.5, max: 2.1 },
        { name: 'British Golden Ale', min: 1.5, max: 2.2 },
        { name: 'British Strong Ale', min: 1.5, max: 2.2 },
        { name: 'Brown IPA', min: 2.2, max: 2.8 },
        { name: 'California Common', min: 2.4, max: 2.8 },
        { name: 'Cream Ale', min: 2.5, max: 2.8 },
        { name: 'Czech Amber Lager', min: 2.2, max: 2.7 },
        { name: 'Czech Dark Lager', min: 2.2, max: 2.7 },
        { name: 'Czech Pale Lager', min: 2.2, max: 2.7 },
        { name: 'Czech Premium Pale Lager', min: 2.2, max: 2.7 },
        { name: 'Dark Mild', min: 1.3, max: 2.0 },
        { name: 'Doppelbock', min: 2.2, max: 2.7 },
        { name: 'Double IPA', min: 2.2, max: 2.7 },
        { name: 'Dunkles Bock', min: 2.2, max: 2.7 },
        { name: 'Dunkles Weissbier', min: 3.0, max: 4.5 },
        { name: 'Eisbock', min: 2.2, max: 2.7 },
        { name: 'English Barleywine', min: 1.6, max: 2.2 },
        { name: 'English IPA', min: 1.5, max: 2.3 },
        { name: 'English Porter', min: 1.8, max: 2.5 },
        { name: 'Festbier', min: 2.2, max: 2.7 },
        { name: 'Flanders Red Ale', min: 2.0, max: 2.6 },
        { name: 'Foreign Extra Stout', min: 2.2, max: 2.6 },
        { name: 'Fruit Lambic', min: 2.0, max: 2.6 },
        { name: 'German Helles Exportbier', min: 2.2, max: 2.6 },
        { name: 'German Leichtbier', min: 2.2, max: 2.6 },
        { name: 'German Pils', min: 2.4, max: 2.8 },
        { name: 'Gose', min: 3.4, max: 3.5 },
        { name: 'Gueuze', min: 2.0, max: 2.6 },
        { name: 'Helles Bock', min: 2.2, max: 2.7 },
        { name: 'Historical Beer - Other', min: 2.2, max: 2.8 },
        { name: 'Imperial Stout', min: 1.5, max: 2.3 },
        { name: 'International Amber Lager', min: 2.2, max: 2.7 },
        { name: 'International Dark Lager', min: 2.2, max: 2.7 },
        { name: 'International Pale Lager', min: 2.2, max: 2.7 },
        { name: 'Irish Extra Stout', min: 2.0, max: 2.5 },
        { name: 'Irish Red Ale', min: 2.0, max: 2.5 },
        { name: 'Irish Stout', min: 1.8, max: 2.3 },
        { name: 'Kentucky Common', min: 2.2, max: 2.8 },
        { name: 'Kölsch', min: 2.4, max: 2.8 },
        { name: 'Lambic', min: 1.5, max: 2.6 },
        { name: 'Lichtenhainer', min: 3.0, max: 3.5 },
        { name: 'London Brown Ale', min: 1.5, max: 2.1 },
        { name: 'Munich Dunkel', min: 2.2, max: 2.7 },
        { name: 'Munich Helles', min: 2.2, max: 2.6 },
        { name: 'Märzen', min: 2.2, max: 2.7 },
        { name: 'NEIPA', min: 2.4, max: 2.6 },
        { name: 'Oatmeal Stout', min: 2.0, max: 2.5 },
        { name: 'Old Ale', min: 1.5, max: 2.3 },
        { name: 'Ordinary Bitter', min: 0.8, max: 1.3 },
        { name: 'Oud Bruin', min: 2.0, max: 2.6 },
        { name: 'Pale Kellerbier', min: 2.2, max: 2.7 },
        { name: 'Piwo Grodziskie', min: 2.8, max: 3.2 },
        { name: 'Pre-Prohibition Lager', min: 2.2, max: 2.7 },
        { name: 'Pre-Prohibition Porter', min: 1.8, max: 2.5 },
        { name: 'Rauchbier', min: 2.2, max: 2.6 },
        { name: 'Red IPA-Red', min: 2.4, max: 2.8 },
        { name: 'Roggenbier', min: 3.0, max: 4.5 },
        { name: 'Rye IPA', min: 2.4, max: 2.8 },
        { name: 'Sahti', min: 2.0, max: 2.5 },
        { name: 'Saison', min: 2.4, max: 3.0 },
        { name: 'Outro / Personalizado', min: 0.0, max: 0.0 }
    ];

    const currentStyle = beerStyles.find(s => s.name === styleInput) || beerStyles[0];

    useEffect(() => {
        const co2Vol = parseFloat(co2VolInput.replace(',', '.'));
        const tempC = parseFloat(tempInput.replace(',', '.'));
        
        if (isNaN(co2Vol) || isNaN(tempC)) return;

        let pressureBar = 0;
        let pressurePsi = 0;
        let sugarGrams = 0;
        let residualCo2 = 0;

        if (typeInput === 'Keg (Forçado)') {
            const tempF = (tempC * 9/5) + 32;
            const denom = 0.01821 + 0.09011 * Math.exp(-(tempF - 32) / 43.11);
            pressurePsi = (co2Vol + 0.003342) / denom - 14.695;
            pressureBar = pressurePsi * 0.0689476;
        } else {
            const volL = parseFloat(batchVolInput.replace(',', '.'));
            const fTempC = parseFloat(fermTempInput.replace(',', '.'));
            
            if (!isNaN(volL) && !isNaN(fTempC)) {
                const fTempF = (fTempC * 9/5) + 32;
                residualCo2 = 3.0378 - 0.050062 * fTempF + 0.00026555 * Math.pow(fTempF, 2);
                if (residualCo2 < 0) residualCo2 = 0;
                
                const co2Needed = co2Vol - residualCo2;
                if (co2Needed > 0) {
                    sugarGrams = co2Needed * 3.82 * volL;
                }
            }
        }

        setResults({
            pressureBar: Math.max(0, pressureBar),
            pressurePsi: Math.max(0, pressurePsi),
            sugarGrams: Math.max(0, sugarGrams),
            residualCo2: Math.max(0, residualCo2)
        });

    }, [co2VolInput, tempInput, typeInput, batchVolInput, fermTempInput]);

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-neutral-800/50">
                <div className="p-4 bg-yellow-500/10 rounded-2xl text-yellow-500">
                    <Wind size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tighter">Carbonatação</h2>
                    <p className="text-neutral-500 mt-1">Calcule a pressão do barril ou o açúcar de priming para seu estilo.</p>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                
                {/* Left Column: Inputs */}
                <div className="space-y-6">
                    
                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-4">
                        <div>
                            <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Estilo da Cerveja</span>
                            <select 
                                value={styleInput} onChange={(e) => {
                                    setStyleInput(e.target.value);
                                    const style = beerStyles.find(s => s.name === e.target.value);
                                    if (style && style.min > 0) {
                                        setCo2VolInput(((style.min + style.max) / 2).toFixed(1));
                                    }
                                }} 
                                className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 appearance-none cursor-pointer"
                            >
                                {beerStyles.map(s => <option key={s.name} value={s.name} className="bg-neutral-900">{s.name}</option>)}
                            </select>
                            
                            {currentStyle.min > 0 && (
                                <p className="text-xs text-neutral-400 mt-3">
                                    Faixa sugerida: <span className="text-yellow-500 font-bold">{currentStyle.min} - {currentStyle.max} CO₂-vol</span>
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Carbonatação</span>
                            <div className="relative">
                                <input 
                                    type="number" step="0.1" value={co2VolInput} onChange={(e) => setCo2VolInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-yellow-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs uppercase">Vol</span>
                            </div>
                        </div>
                        <div>
                            <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Temp. de Carb.</span>
                            <div className="relative">
                                <input 
                                    type="number" step="1" value={tempInput} onChange={(e) => setTempInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-yellow-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs uppercase">°C</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-4">
                        <div>
                            <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Tipo de Carbonatação</span>
                            <select 
                                value={typeInput} onChange={(e) => setTypeInput(e.target.value as any)} 
                                className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 appearance-none cursor-pointer"
                            >
                                <option value="Keg (Forçado)" className="bg-neutral-900">Keg (Forçado)</option>
                                <option value="Priming (Açúcar)" className="bg-neutral-900">Priming (Açúcar)</option>
                            </select>
                        </div>
                    </div>

                    {typeInput === 'Priming (Açúcar)' && (
                        <div className="grid grid-cols-2 gap-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div>
                                <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Volume do Lote</span>
                                <div className="relative">
                                    <input 
                                        type="number" step="1" value={batchVolInput} onChange={(e) => setBatchVolInput(e.target.value)}
                                        className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs">L</span>
                                </div>
                            </div>
                            <div>
                                <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Temp. Fermentação</span>
                                <div className="relative">
                                    <input 
                                        type="number" step="1" value={fermTempInput} onChange={(e) => setFermTempInput(e.target.value)}
                                        className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs">°C</span>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Right Column: Results */}
                <div className="bg-neutral-950 rounded-2xl p-6 border border-neutral-800/50 flex flex-col justify-center">
                    
                    <div className="text-center mb-8">
                        {typeInput === 'Keg (Forçado)' ? (
                            <>
                                <span className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Pressão do Barril</span>
                                <div className="text-6xl font-black text-yellow-500 tracking-tighter mb-2">
                                    {results.pressureBar.toFixed(2)}<span className="text-2xl text-yellow-500/50 ml-1">Bar</span>
                                </div>
                                <div className="text-sm font-bold text-white uppercase tracking-widest">
                                    A {tempInput} °C
                                </div>
                            </>
                        ) : (
                            <>
                                <span className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Açúcar para Adicionar</span>
                                <div className="text-6xl font-black text-yellow-500 tracking-tighter mb-2">
                                    {results.sugarGrams.toFixed(1)}<span className="text-2xl text-yellow-500/50 ml-1">g</span>
                                </div>
                                <div className="text-sm font-bold text-white uppercase tracking-widest">
                                    Diluídos em água fervida
                                </div>
                            </>
                        )}
                    </div>

                    <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800 text-center">
                        {typeInput === 'Keg (Forçado)' ? (
                            <>
                                <span className="block text-xs text-neutral-400 mb-4">
                                    Mantenha esta pressão por aproximadamente <strong>1 semana</strong> para alcançar <strong>{co2VolInput} vol</strong> de CO₂.
                                </span>
                                <div className="pt-4 border-t border-neutral-800/50 flex justify-between items-center text-xs">
                                    <span className="text-neutral-500 font-bold uppercase tracking-widest">Equivalente a</span>
                                    <span className="text-white font-mono">{results.pressurePsi.toFixed(1)} PSI</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <span className="block text-xs text-neutral-400 mb-4">
                                    Adicione o açúcar no momento do envase para alcançar <strong>{co2VolInput} vol</strong> de CO₂ na garrafa.
                                </span>
                                <div className="pt-4 border-t border-neutral-800/50 flex justify-between items-center text-xs">
                                    <span className="text-neutral-500 font-bold uppercase tracking-widest">CO₂ Residual (Estimado)</span>
                                    <span className="text-white font-mono">{results.residualCo2.toFixed(2)} vol</span>
                                </div>
                            </>
                        )}
                    </div>

                </div>

            </div>
        </div>
    );
};
