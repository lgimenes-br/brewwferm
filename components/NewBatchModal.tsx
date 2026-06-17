
import React, { useState } from 'react';
import { X, Plus, Trash2, Thermometer, Clock } from 'lucide-react';
import { FermentationStep, BeerStyle } from '../types';

interface NewBatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        name: string;
        style: string;
        og: number;
        fg: number;
        profile: FermentationStep[];
    }) => void;
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

export const NewBatchModal: React.FC<NewBatchModalProps> = ({ isOpen, onClose, onSubmit }) => {
    const [name, setName] = useState('');
    const [style, setStyle] = useState('IPA');
    const [og, setOg] = useState('1.050');
    const [fg, setFg] = useState('1.010');
    const [profile, setProfile] = useState<FermentationStep[]>([
        { id: '1', name: 'Fermentação Primária', temperature: 18, duration: 7 },
        { id: '2', name: 'Maturação', temperature: 18, duration: 3 }
    ]);

    const handleAddStep = () => {
        const newStep: FermentationStep = {
            id: Date.now().toString(),
            name: `Etapa ${profile.length + 1}`,
            temperature: 18,
            duration: 1
        };
        setProfile([...profile, newStep]);
    };

    const handleRemoveStep = (id: string) => {
        if (profile.length > 1) {
            setProfile(profile.filter(s => s.id !== id));
        }
    };

    const handleUpdateStep = (id: string, field: keyof FermentationStep, value: any) => {
        setProfile(profile.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!name.trim()) {
            alert('Por favor, insira o nome da cerveja');
            return;
        }

        const ogNum = parseFloat(og);
        const fgNum = parseFloat(fg);

        if (isNaN(ogNum) || ogNum < 1.000 || ogNum > 1.200) {
            alert('OG deve estar entre 1.000 e 1.200');
            return;
        }

        if (isNaN(fgNum) || fgNum < 0.990 || fgNum > 1.200) {
            alert('FG deve estar entre 0.990 e 1.200');
            return;
        }

        if (ogNum <= fgNum) {
            alert('OG deve ser maior que FG');
            return;
        }

        onSubmit({
            name: name.trim(),
            style,
            og: ogNum,
            fg: fgNum,
            profile
        });

        // Reset form
        setName('');
        setStyle('IPA');
        setOg('1.050');
        setFg('1.010');
        setProfile([
            { id: '1', name: 'Fermentação Primária', temperature: 18, duration: 7 },
            { id: '2', name: 'Maturação', temperature: 18, duration: 3 }
        ]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-neutral-900 rounded-3xl border border-neutral-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-6 flex justify-between items-center">
                    <h2 className="text-2xl font-light text-white">Iniciar Nova Produção</h2>
                    <button
                        onClick={onClose}
                        className="text-neutral-500 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Beer Name */}
                    <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">
                            Nome da Cerveja
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neutral-600 transition-colors"
                            placeholder="Ex: IPA da Casa"
                            required
                        />
                    </div>

                    {/* Beer Style */}
                    <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">
                            Estilo
                        </label>
                        <select
                            value={style}
                            onChange={(e) => setStyle(e.target.value)}
                            className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neutral-600 transition-colors"
                        >
                            {BEER_STYLES.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* OG and FG */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">
                                OG (Original Gravity)
                            </label>
                            <input
                                type="number"
                                step="0.001"
                                value={og}
                                onChange={(e) => setOg(e.target.value)}
                                className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neutral-600 transition-colors"
                                placeholder="1.050"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">
                                FG (Final Gravity)
                            </label>
                            <input
                                type="number"
                                step="0.001"
                                value={fg}
                                onChange={(e) => setFg(e.target.value)}
                                className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neutral-600 transition-colors"
                                placeholder="1.010"
                                required
                            />
                        </div>
                    </div>

                    {/* Fermentation Profile */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest">
                                Perfil de Fermentação
                            </label>
                            <button
                                type="button"
                                onClick={handleAddStep}
                                className="flex items-center gap-2 px-3 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-xs text-neutral-300 transition-colors"
                            >
                                <Plus size={14} />
                                Adicionar Etapa
                            </button>
                        </div>

                        <div className="space-y-3">
                            {profile.map((step, index) => (
                                <div key={step.id} className="bg-neutral-800/30 border border-neutral-800 rounded-xl p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-mono text-neutral-400">
                                            {index + 1}
                                        </span>
                                        <input
                                            type="text"
                                            value={step.name}
                                            onChange={(e) => handleUpdateStep(step.id, 'name', e.target.value)}
                                            className="flex-1 bg-transparent border-b border-neutral-700 text-sm text-white outline-none focus:border-neutral-600 transition-colors py-1"
                                            placeholder="Nome da etapa"
                                        />
                                        {profile.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveStep(step.id)}
                                                className="text-neutral-600 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
                                                <Thermometer size={12} />
                                                Temperatura (°C)
                                            </label>
                                            <input
                                                type="number"
                                                value={step.temperature}
                                                onChange={(e) => handleUpdateStep(step.id, 'temperature', parseFloat(e.target.value) || 0)}
                                                className="w-full bg-neutral-900/50 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600 transition-colors"
                                                min="0"
                                                max="30"
                                            />
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
                                                <Clock size={12} />
                                                Duração (dias)
                                            </label>
                                            <input
                                                type="number"
                                                value={step.duration}
                                                onChange={(e) => handleUpdateStep(step.id, 'duration', parseInt(e.target.value) || 0)}
                                                className="w-full bg-neutral-900/50 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600 transition-colors"
                                                min="1"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-neutral-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-white font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-6 py-3 bg-white hover:bg-neutral-200 text-black rounded-xl font-medium transition-colors"
                        >
                            Iniciar Produção
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
