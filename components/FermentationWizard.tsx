import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, FlaskConical, Thermometer, Info, Beaker, CheckCircle2, Plus, Trash2, Rocket } from 'lucide-react';
import { Fermenter, FermentationStep, BeerStyle } from '../types';

interface FermentationWizardProps {
    fermenter: Fermenter;
    onStart: (data: {
        name: string;
        style: string;
        og: number;
        fg: number;
        profile: FermentationStep[];
    }) => void;
    onCancel: () => void;
}

const BEER_STYLES = [
    'IPA',
    'PALE ALE',
    'LAGER',
    'PILSNER',
    'STOUT',
    'PORTER',
    'WHEAT',
    'SAISON',
    'SOUR',
    'OTHER'
];

export const FermentationWizard: React.FC<FermentationWizardProps> = ({ fermenter, onStart, onCancel }) => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [style, setStyle] = useState('IPA');
    const [volume, setVolume] = useState('20');
    const [og, setOg] = useState('1.050');
    const [fg, setFg] = useState('1.010');
    
    // Default standard profile
    const [profile, setProfile] = useState<FermentationStep[]>([
        { id: '1', name: 'Fermentação Primária', temperature: 18, duration: 7 },
        { id: '2', name: 'Maturação', temperature: 18, duration: 3 }
    ]);

    const handleNext = () => {
        if (step < 4) setStep(step + 1);
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
        else onCancel();
    };

    const handleAddStep = () => {
        const newStep: FermentationStep = {
            id: Math.random().toString(36).substr(2, 9),
            name: `Etapa ${profile.length + 1}`,
            temperature: 18,
            duration: 1
        };
        setProfile([...profile, newStep]);
    };

    const handleUpdateStep = (id: string, field: keyof FermentationStep, value: any) => {
        setProfile(profile.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleRemoveStep = (id: string) => {
        setProfile(profile.filter(s => s.id !== id));
    };

    const handleStart = () => {
        onStart({
            name,
            style,
            og: parseFloat(og) || 1.050,
            fg: parseFloat(fg) || 1.010,
            profile
        });
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={handleBack} className="w-10 h-10 bg-neutral-900 border border-neutral-800 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Nova Fermentação</h1>
                    <p className="text-neutral-400 text-sm">Fermentador: {fermenter.name || 'Dispositivo'} ({fermenter.id})</p>
                </div>
            </div>

            {/* Stepper */}
            <div className="flex items-center justify-between mb-12 relative">
                <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-neutral-800 -z-10" />
                <div className={`absolute top-1/2 left-0 h-[2px] bg-blue-500 transition-all duration-300 -z-10`} style={{ width: `${((step - 1) / 3) * 100}%` }} />
                
                {[1, 2, 3, 4].map((s) => (
                    <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors ${
                        step === s ? 'bg-blue-500 border-blue-500 text-white' : 
                        step > s ? 'bg-blue-500/20 border-blue-500 text-blue-500' : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                    }`}>
                        {s}
                    </div>
                ))}
            </div>

            <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-8 backdrop-blur-sm min-h-[400px]">
                
                {/* Step 1: Identidade */}
                {step === 1 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-4 mb-8 text-neutral-300">
                            <Info size={24} className="text-blue-500" />
                            <h2 className="text-xl font-medium">O que vamos produzir hoje?</h2>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Nome da Receita</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ex: IPA da Casa"
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neutral-500 transition-colors text-lg"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Estilo</label>
                                    <select
                                        value={style}
                                        onChange={(e) => setStyle(e.target.value)}
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neutral-500 transition-colors"
                                    >
                                        {BEER_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Volume Esperado (L)</label>
                                    <input
                                        type="number"
                                        value={volume}
                                        onChange={(e) => setVolume(e.target.value)}
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neutral-500 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Gravidade */}
                {step === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-4 mb-8 text-neutral-300">
                            <FlaskConical size={24} className="text-purple-500" />
                            <h2 className="text-xl font-medium">Densidade Prevista</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-800">
                                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">OG (Original Gravity)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    value={og}
                                    onChange={(e) => setOg(e.target.value)}
                                    className="w-full bg-transparent border-b-2 border-neutral-700 text-white text-4xl font-mono text-center focus:outline-none focus:border-purple-500 transition-colors py-2"
                                />
                                <p className="text-center text-neutral-500 text-xs mt-4">Gravidade antes da fermentação</p>
                            </div>
                            <div className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-800">
                                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">FG (Final Gravity)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    value={fg}
                                    onChange={(e) => setFg(e.target.value)}
                                    className="w-full bg-transparent border-b-2 border-neutral-700 text-white text-4xl font-mono text-center focus:outline-none focus:border-purple-500 transition-colors py-2"
                                />
                                <p className="text-center text-neutral-500 text-xs mt-4">Gravidade alvo desejada</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Perfil */}
                {step === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4 text-neutral-300">
                                <Thermometer size={24} className="text-orange-500" />
                                <h2 className="text-xl font-medium">Perfil de Temperatura</h2>
                            </div>
                            <button onClick={handleAddStep} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                                <Plus size={16} /> Adicionar Rampa
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {profile.map((p, index) => (
                                <div key={p.id} className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-neutral-800/30 border border-neutral-800 p-4 rounded-xl">
                                    <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 font-bold shrink-0">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 w-full">
                                        <input 
                                            type="text" 
                                            value={p.name}
                                            onChange={(e) => handleUpdateStep(p.id, 'name', e.target.value)}
                                            className="w-full bg-transparent border-b border-transparent hover:border-neutral-700 focus:border-neutral-500 outline-none text-white font-medium px-1 py-1 transition-colors"
                                            placeholder="Nome da Etapa"
                                        />
                                    </div>
                                    <div className="flex items-center gap-4 w-full md:w-auto">
                                        <div className="flex-1 md:w-32">
                                            <div className="text-[10px] text-neutral-500 uppercase font-bold ml-1 mb-1">Temp (°C)</div>
                                            <input 
                                                type="number" 
                                                value={p.temperature}
                                                onChange={(e) => handleUpdateStep(p.id, 'temperature', parseFloat(e.target.value))}
                                                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-white outline-none focus:border-neutral-600"
                                            />
                                        </div>
                                        <div className="flex-1 md:w-32">
                                            <div className="text-[10px] text-neutral-500 uppercase font-bold ml-1 mb-1">Tempo (Dias)</div>
                                            <input 
                                                type="number" 
                                                value={p.duration}
                                                onChange={(e) => handleUpdateStep(p.id, 'duration', parseInt(e.target.value))}
                                                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-white outline-none focus:border-neutral-600"
                                            />
                                        </div>
                                        {profile.length > 1 && (
                                            <button onClick={() => handleRemoveStep(p.id)} className="w-10 h-10 mt-5 rounded-lg flex items-center justify-center text-neutral-600 hover:text-red-500 hover:bg-neutral-800 transition-colors shrink-0">
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 4: Resumo */}
                {step === 4 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 text-center flex flex-col items-center justify-center h-full">
                        <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Rocket size={32} className="text-green-500" />
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">Tudo Pronto!</h2>
                        <p className="text-neutral-400 mb-8 max-w-sm mx-auto">
                            A sua receita <strong>{name || 'Sem Nome'} ({style})</strong> está configurada para durar um total de {profile.reduce((acc, curr) => acc + curr.duration, 0)} dias em {profile.length} rampas de temperatura.
                        </p>
                        <p className="text-neutral-500 text-sm mb-8">
                            A placa será configurada imediatamente e a contagem regressiva da primeira etapa será iniciada.
                        </p>
                    </div>
                )}

            </div>

            {/* Footer Navigation */}
            <div className="flex justify-end mt-8">
                {step < 4 ? (
                    <button 
                        onClick={handleNext}
                        disabled={step === 1 && (!name || !style)}
                        className="px-8 py-4 bg-white text-black font-bold rounded-2xl flex items-center gap-2 hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Próximo <ArrowRight size={20} />
                    </button>
                ) : (
                    <button 
                        onClick={handleStart}
                        className="px-10 py-4 bg-green-500 text-black font-bold text-lg rounded-2xl flex items-center gap-3 hover:bg-green-400 hover:scale-105 transition-all shadow-[0_0_40px_rgba(34,197,94,0.3)]"
                    >
                        <CheckCircle2 size={24} /> INICIAR FERMENTAÇÃO
                    </button>
                )}
            </div>
        </div>
    );
};
