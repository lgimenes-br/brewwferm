import React, { useState, useEffect } from 'react';
import { Thermometer } from 'lucide-react';

export const HydrometerTempCalculator: React.FC = () => {
    const [measuredGravInput, setMeasuredGravInput] = useState<string>('1.010');
    const [tempInput, setTempInput] = useState<string>('23');
    const [calibTempInput, setCalibTempInput] = useState<string>('20');
    
    const [results, setResults] = useState({
        correctedGrav: 1.010,
        isPointsFormat: false
    });

    useEffect(() => {
        let mGrav = parseFloat(measuredGravInput.replace(',', '.'));
        const tempC = parseFloat(tempInput.replace(',', '.'));
        const calibC = parseFloat(calibTempInput.replace(',', '.'));

        if (isNaN(mGrav) || isNaN(tempC) || isNaN(calibC) || mGrav <= 0) return;

        let isPoints = false;
        if (mGrav > 200) {
            isPoints = true;
            mGrav = mGrav / 1000;
        }

        // Convert C to F
        const tempF = (tempC * 9/5) + 32;
        const calibF = (calibC * 9/5) + 32;

        const calcFactor = (f: number) => {
            return 1.00130346 - (0.000134722124 * f) + (0.00000204052596 * Math.pow(f, 2)) - (0.00000000232820948 * Math.pow(f, 3));
        };

        const num = calcFactor(tempF);
        const den = calcFactor(calibF);

        let correctedSg = mGrav * (num / den);

        setResults({
            correctedGrav: correctedSg,
            isPointsFormat: isPoints
        });

    }, [measuredGravInput, tempInput, calibTempInput]);

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-neutral-800/50">
                <div className="p-4 bg-orange-400/10 rounded-2xl text-orange-400">
                    <Thermometer size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tighter">Correção de Temperatura do Densímetro</h2>
                    <p className="text-neutral-500 mt-1">Ajuste a leitura da densidade de acordo com a temperatura do mosto.</p>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                
                {/* Left Column: Inputs */}
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        
                        <div>
                            <label className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Densidade Mensurada</label>
                            <div className="relative">
                                <input 
                                    type="number" step="0.001" value={measuredGravInput} onChange={(e) => setMeasuredGravInput(e.target.value)}
                                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-orange-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs">SG</span>
                            </div>
                            <p className="text-[10px] text-neutral-600 mt-2">Você pode usar formato 1.010 ou 1010.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Temperatura</label>
                                <div className="relative">
                                    <input 
                                        type="number" step="0.1" value={tempInput} onChange={(e) => setTempInput(e.target.value)}
                                        className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-orange-500 transition-colors"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs">°C</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Temp. de Calibração</label>
                                <div className="relative">
                                    <input 
                                        type="number" step="0.1" value={calibTempInput} onChange={(e) => setCalibTempInput(e.target.value)}
                                        className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-orange-500 transition-colors"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs">°C</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Right Column: Results */}
                <div className="bg-neutral-950 rounded-2xl p-6 border border-neutral-800/50 flex flex-col justify-center relative">
                    
                    <div className="text-center mb-8">
                        <span className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Densidade Corrigida</span>
                        <div className="text-6xl font-black text-orange-400 tracking-tighter mb-2 font-mono">
                            {results.isPointsFormat ? (results.correctedGrav * 1000).toFixed(3) : results.correctedGrav.toFixed(4)}
                        </div>
                        <div className="text-sm font-bold text-white uppercase tracking-widest">{results.isPointsFormat ? 'Pontos' : 'SG'}</div>
                    </div>

                    <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
                        <span className="block text-xs text-neutral-400">
                            Ao medir o mosto a <strong>{tempInput}°C</strong> em um densímetro calibrado a <strong>{calibTempInput}°C</strong>, a leitura real de {measuredGravInput} corresponde a <strong>{results.isPointsFormat ? (results.correctedGrav * 1000).toFixed(3) : results.correctedGrav.toFixed(4)}</strong>.
                        </span>
                    </div>

                    <div className="text-center pt-8">
                         <p className="text-[10px] text-neutral-500 flex items-center justify-center gap-2 max-w-2xl mx-auto">
                            <span className="inline-block min-w-4 min-h-4 w-4 h-4 bg-neutral-700 text-neutral-300 rounded-full text-[9px] font-bold text-center leading-4">i</span>
                            Entre com sua densidade e temperatura e obtenha sua medição de densidade corrigida pela temperatura. Opcionalmente, ajuste a temperatura de calibração do densímetro.
                        </p>
                    </div>

                </div>

            </div>
        </div>
    );
};
