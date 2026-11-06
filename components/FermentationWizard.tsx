import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ArrowLeft, FlaskConical, Thermometer, Info, CheckCircle2, Plus, Trash2, Rocket, Upload, Bookmark, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Fermenter, FermentationStep, normalizeGravity } from '../types';
import { fetchRecipes, saveRecipe, deleteRecipe } from '../services/api';

interface FermentationWizardProps {
    fermenter: Fermenter;
    onStart: (data: {
        name: string;
        style: string;
        volume: number;
        og: number;
        fg: number;
        profile: FermentationStep[];
        ingredients?: any;
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

const BUILTIN_PRESETS: { id: string; label: string; steps: Omit<FermentationStep, 'id'>[] }[] = [
    {
        id: 'ale_classic',
        label: 'Ale Clássica (18°C -> 20°C -> Cold Crash)',
        steps: [
            { name: 'Fermentação Primária', temperature: 18, duration: 5, triggerGravity: 1.018 },
            { name: 'Descanso de Diacetil', temperature: 20, duration: 3 },
            { name: 'Cold Crash', temperature: 2, duration: 3 }
        ]
    },
    {
        id: 'ipa_neipa',
        label: 'IPA / NEIPA (Dry Hop & Cold Crash)',
        steps: [
            { name: 'Primária Ativa', temperature: 19, duration: 4, triggerGravity: 1.020 },
            { name: 'Dry Hop / Biotransformação', temperature: 21, duration: 3 },
            { name: 'Maturação', temperature: 15, duration: 2 },
            { name: 'Cold Crash', temperature: 1, duration: 3 }
        ]
    },
    {
        id: 'lager_pilsner',
        label: 'Lager / Pilsner (10°C -> Diacetil 16°C -> Lagering)',
        steps: [
            { name: 'Fermentação Lager', temperature: 10, duration: 7, triggerGravity: 1.022 },
            { name: 'Descanso de Diacetil', temperature: 16, duration: 3 },
            { name: 'Lagering', temperature: 1, duration: 10 }
        ]
    },
    {
        id: 'kveik_fast',
        label: 'Kveik Express (32°C -> Cold Crash)',
        steps: [
            { name: 'Fermentação Kveik Alta Temp', temperature: 32, duration: 3, triggerGravity: 1.012 },
            { name: 'Cold Crash', temperature: 2, duration: 2 }
        ]
    }
];

const matchWizardStyle = (raw?: string): string => {
    const s = (raw || '').toUpperCase();
    for (const candidate of BEER_STYLES) {
        if (s.includes(candidate)) return candidate;
    }
    if (s.includes('WEIZEN') || s.includes('WIT')) return 'WHEAT';
    if (s.includes('PILS')) return 'PILSNER';
    return 'IPA';
};

export const parseRecipeContent = (content: string) => {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        const rec = parsed?.beerjson?.recipes?.[0] || parsed?.recipes?.[0] || parsed?.recipe || parsed;
        const name = rec?.name || 'Receita Importada';
        const styleName = typeof rec?.style === 'string' ? rec.style : (rec?.style?.name || 'IPA');
        const volRaw = rec?.batch_size?.value ?? rec?.batchSize ?? rec?.volume ?? 20;
        const ogRaw = rec?.original_gravity?.value ?? rec?.og ?? rec?.est_og ?? 1.050;
        const fgRaw = rec?.final_gravity?.value ?? rec?.fg ?? rec?.est_fg ?? 1.010;

        const rawSteps = rec?.fermentation?.fermentation_steps || rec?.steps || rec?.profile || [];
        const steps: FermentationStep[] = Array.isArray(rawSteps) && rawSteps.length > 0
            ? rawSteps.map((st: any, idx: number) => {
                const temp = parseFloat(st?.start_temperature?.value ?? st?.temperature ?? st?.t ?? 18);
                const dur = parseFloat(st?.step_time?.value ?? st?.duration ?? st?.days ?? st?.d ?? 5);
                const trig = normalizeGravity(st?.triggerGravity ?? st?.end_gravity?.value ?? st?.g, 0);
                return {
                    id: `imp_${idx + 1}`,
                    name: st?.name || st?.n || `Etapa ${idx + 1}`,
                    temperature: !isNaN(temp) ? temp : 18,
                    duration: !isNaN(dur) && dur > 0 ? dur : 1,
                    ...(trig > 0 ? { triggerGravity: trig } : {})
                };
            })
            : [];

        const ingSource = rec?.ingredients || rec;
        const ingredients = {
            fermentables: Array.isArray(ingSource?.fermentables || ingSource?.fermentable_additions)
                ? (ingSource.fermentables || ingSource.fermentable_additions).map((f: any) => ({
                    name: f.name || 'Malte',
                    amount: parseFloat(f?.amount?.value ?? f?.amount ?? 0) || 1
                }))
                : [],
            hops: Array.isArray(ingSource?.hops || ingSource?.hop_additions)
                ? (ingSource.hops || ingSource.hop_additions).map((h: any) => ({
                    name: h.name || 'Lúpulo',
                    amount: parseFloat(h?.amount?.value ?? h?.amount ?? 0) || 10
                }))
                : [],
            yeasts: Array.isArray(ingSource?.yeasts || ingSource?.culture_additions)
                ? (ingSource.yeasts || ingSource.culture_additions).map((y: any) => ({
                    name: y.name || 'Levedura',
                    amount: parseFloat(y?.amount?.value ?? y?.amount ?? 1) || 1
                }))
                : [],
            notes: rec?.notes || ''
        };

        return {
            name: String(name),
            style: matchWizardStyle(styleName),
            volume: !isNaN(parseFloat(volRaw)) && parseFloat(volRaw) > 0 ? parseFloat(volRaw) : 20,
            og: normalizeGravity(ogRaw, 1.050),
            fg: normalizeGravity(fgRaw, 1.010),
            steps,
            ingredients
        };
    }

    // BeerXML parsing
    const parser = new DOMParser();
    const xml = parser.parseFromString(trimmed, 'text/xml');
    const recipeNode = xml.querySelector('RECIPE') || xml.documentElement;
    const getTag = (parent: Element | Document, tag: string) =>
        parent.querySelector(tag)?.textContent?.trim() || '';

    const name = getTag(recipeNode, 'NAME') || 'Receita BeerXML';
    const styleNode = recipeNode.querySelector('STYLE');
    const styleName = styleNode ? getTag(styleNode, 'NAME') : 'IPA';
    const volume = parseFloat(getTag(recipeNode, 'BATCH_SIZE')) || 20;
    const og = normalizeGravity(getTag(recipeNode, 'OG') || getTag(recipeNode, 'EST_OG'), 1.050);
    const fg = normalizeGravity(getTag(recipeNode, 'FG') || getTag(recipeNode, 'EST_FG'), 1.010);

    const steps: FermentationStep[] = [];
    const primaryAge = parseFloat(getTag(recipeNode, 'PRIMARY_AGE'));
    const primaryTemp = parseFloat(getTag(recipeNode, 'PRIMARY_TEMP'));
    if (!isNaN(primaryAge) && primaryAge > 0) {
        steps.push({
            id: 'xml_1',
            name: 'Fermentação Primária',
            temperature: !isNaN(primaryTemp) ? primaryTemp : 18,
            duration: primaryAge
        });
    }
    const secondaryAge = parseFloat(getTag(recipeNode, 'SECONDARY_AGE'));
    const secondaryTemp = parseFloat(getTag(recipeNode, 'SECONDARY_TEMP'));
    if (!isNaN(secondaryAge) && secondaryAge > 0) {
        steps.push({
            id: 'xml_2',
            name: 'Maturação / Secundária',
            temperature: !isNaN(secondaryTemp) ? secondaryTemp : 18,
            duration: secondaryAge
        });
    }
    const tertiaryAge = parseFloat(getTag(recipeNode, 'TERTIARY_AGE'));
    const tertiaryTemp = parseFloat(getTag(recipeNode, 'TERTIARY_TEMP'));
    if (!isNaN(tertiaryAge) && tertiaryAge > 0) {
        steps.push({
            id: 'xml_3',
            name: 'Cold Crash / Terciária',
            temperature: !isNaN(tertiaryTemp) ? tertiaryTemp : 2,
            duration: tertiaryAge
        });
    }

    const fermentables = Array.from(recipeNode.querySelectorAll('FERMENTABLES > FERMENTABLE')).map(el => ({
        name: getTag(el, 'NAME') || 'Malte',
        amount: parseFloat(getTag(el, 'AMOUNT')) || 1
    }));
    const hops = Array.from(recipeNode.querySelectorAll('HOPS > HOP')).map(el => ({
        name: getTag(el, 'NAME') || 'Lúpulo',
        amount: Math.round((parseFloat(getTag(el, 'AMOUNT')) || 0.01) * 1000) // BeerXML stores hops in kg
    }));
    const yeasts = Array.from(recipeNode.querySelectorAll('YEASTS > YEAST')).map(el => ({
        name: getTag(el, 'NAME') || 'Levedura',
        amount: 1
    }));
    const notes = getTag(recipeNode, 'NOTES');

    return {
        name,
        style: matchWizardStyle(styleName),
        volume,
        og,
        fg,
        steps,
        ingredients: { fermentables, hops, yeasts, notes }
    };
};

export const FermentationWizard: React.FC<FermentationWizardProps> = ({ fermenter, onStart, onCancel }) => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [style, setStyle] = useState('IPA');
    const [volume, setVolume] = useState('20');
    const [og, setOg] = useState('1.050');
    const [fg, setFg] = useState('1.010');
    const [importedIngredients, setImportedIngredients] = useState<any>(undefined);
    const [savedRecipes, setSavedRecipes] = useState<any[]>([]);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Default standard profile
    const [profile, setProfile] = useState<FermentationStep[]>([
        { id: '1', name: 'Fermentação Primária', temperature: 18, duration: 7 },
        { id: '2', name: 'Maturação', temperature: 18, duration: 3 }
    ]);

    useEffect(() => {
        fetchRecipes()
            .then(data => {
                if (Array.isArray(data)) setSavedRecipes(data);
            })
            .catch(() => {});
    }, []);

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = typeof file.text === 'function'
                ? await file.text()
                : await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ''));
                    reader.onerror = () => reject(reader.error);
                    reader.readAsText(file);
                });
            const parsed = parseRecipeContent(text);
            setName(parsed.name);
            setStyle(parsed.style);
            setVolume(String(parsed.volume));
            setOg(parsed.og.toFixed(3));
            setFg(parsed.fg.toFixed(3));
            if (parsed.steps.length > 0) {
                setProfile(parsed.steps);
            }
            if (parsed.ingredients) {
                setImportedIngredients(parsed.ingredients);
            }
            toast.success(`Receita "${parsed.name}" importada com sucesso!`);
        } catch (err) {
            console.error('Recipe import error:', err);
            toast.error('Arquivo inválido. Use um arquivo BeerXML (.xml) ou BeerJSON (.json).');
        } finally {
            if (e.target) e.target.value = '';
        }
    };

    const handleApplyBuiltinPreset = (presetId: string) => {
        const found = BUILTIN_PRESETS.find(p => p.id === presetId);
        if (!found) return;
        setProfile(found.steps.map((s, idx) => ({
            ...s,
            id: `preset_${idx + 1}_${Date.now()}`
        })));
        toast.success(`Preset "${found.label}" aplicado!`);
    };

    const handleApplySavedRecipe = (recipe: any) => {
        if (Array.isArray(recipe.steps) && recipe.steps.length > 0) {
            setProfile(recipe.steps.map((s: any, idx: number) => {
                const trig = normalizeGravity(s.triggerGravity ?? s.trigger_gravity, 0);
                return {
                    id: `saved_${recipe.id}_${idx}`,
                    name: s.name || s.n || `Etapa ${idx + 1}`,
                    temperature: !isNaN(parseFloat(s.temperature ?? s.t)) ? parseFloat(s.temperature ?? s.t) : 18,
                    duration: !isNaN(parseFloat(s.duration ?? s.days ?? s.d)) ? parseFloat(s.duration ?? s.days ?? s.d) : 1,
                    ...(trig > 0 ? { triggerGravity: trig } : {})
                };
            }));
            toast.success(`Perfil "${recipe.name}" carregado!`);
        }
    };

    const handleSaveFavoriteProfile = async () => {
        const profileName = (name || '').trim() || `Perfil ${style}`;
        setIsSavingProfile(true);
        try {
            const res = await saveRecipe({
                name: profileName,
                style,
                og: normalizeGravity(og, 1.050),
                fg: normalizeGravity(fg, 1.010),
                steps: profile.map((s, idx) => {
                    const trig = normalizeGravity(s.triggerGravity, 0);
                    return {
                        name: (s.name || '').trim() || `Etapa ${idx + 1}`,
                        temperature: isNaN(Number(s.temperature)) ? 18 : Number(s.temperature),
                        duration: isNaN(Number(s.duration)) || Number(s.duration) <= 0 ? 1 : Number(s.duration),
                        ...(trig > 0 ? { triggerGravity: trig } : {})
                    };
                })
            });
            const updated = await fetchRecipes().catch(() => null);
            if (Array.isArray(updated)) {
                setSavedRecipes(updated);
            } else if (res?.id) {
                setSavedRecipes(prev => [{ id: res.id, name: profileName, style, steps: profile }, ...prev]);
            }
            toast.success(`Perfil "${profileName}" salvo nos favoritos!`);
        } catch (err) {
            toast.error('Erro ao salvar perfil favorito.');
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleDeleteSavedRecipe = async (id: string | number) => {
        try {
            await deleteRecipe(id);
            setSavedRecipes(prev => prev.filter(r => String(r.id) !== String(id)));
            toast.success('Perfil favorito removido.');
        } catch (err) {
            toast.error('Erro ao remover perfil favorito.');
        }
    };

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

    const [isStarting, setIsStarting] = useState(false);

    const handleStart = () => {
        if (isStarting) return;
        setIsStarting(true);
        const sanitizedProfile = profile.map((s, idx) => {
            const parsedTrigger = normalizeGravity(s.triggerGravity, 0);
            const { triggerGravity, ...restStep } = s;
            return {
                ...restStep,
                name: (s.name || '').trim() || `Etapa ${idx + 1}`,
                temperature: s.temperature === null || s.temperature === ('' as any) || isNaN(Number(s.temperature)) ? 18 : Number(s.temperature),
                duration: isNaN(Number(s.duration)) || Number(s.duration) <= 0 ? 1 : Number(s.duration),
                ...(parsedTrigger > 0 ? { triggerGravity: parsedTrigger } : {})
            };
        });
        const parsedVol = parseFloat(volume);
        const parsedOg = normalizeGravity(og, 1.050);
        const parsedFg = normalizeGravity(fg, 1.010);
        onStart({
            name: name.trim() || 'Sem Nome',
            style,
            volume: !isNaN(parsedVol) && parsedVol > 0 ? parsedVol : 20,
            og: parsedOg > 0 ? parsedOg : 1.050,
            fg: parsedFg > 0 ? parsedFg : 1.010,
            profile: sanitizedProfile,
            ...(importedIngredients ? { ingredients: importedIngredients } : {})
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
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 text-neutral-300">
                            <div className="flex items-center gap-4">
                                <Info size={24} className="text-blue-500" />
                                <h2 className="text-xl font-medium">O que vamos produzir hoje?</h2>
                            </div>
                            <div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    data-testid="recipe-file-input"
                                    accept=".xml,.json,application/xml,application/json"
                                    onChange={handleImportFile}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors"
                                >
                                    <Upload size={14} /> Importar BeerXML / JSON
                                </button>
                            </div>
                        </div>

                        {importedIngredients && (
                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-xs text-green-400 flex items-center gap-2">
                                <CheckCircle2 size={16} className="shrink-0" />
                                <span>
                                    Receita e ingredientes importados ({importedIngredients.fermentables?.length || 0} maltes, {importedIngredients.hops?.length || 0} lúpulos, {importedIngredients.yeasts?.length || 0} leveduras).
                                </span>
                            </div>
                        )}
                        
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
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-4 text-neutral-300">
                                <Thermometer size={24} className="text-orange-500" />
                                <h2 className="text-xl font-medium">Perfil de Temperatura</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleSaveFavoriteProfile}
                                    disabled={isSavingProfile}
                                    className="px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                                >
                                    <Bookmark size={14} /> Salvar Favorito
                                </button>
                                <button onClick={handleAddStep} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                                    <Plus size={16} /> Adicionar Rampa
                                </button>
                            </div>
                        </div>

                        {/* Presets e Perfis Favoritos Salvos */}
                        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-wider">
                                <Sparkles size={14} className="text-amber-400" /> Presets Rápidos de Fermentação
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {BUILTIN_PRESETS.map(preset => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => handleApplyBuiltinPreset(preset.id)}
                                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs transition-colors border border-neutral-700/60"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>

                            {savedRecipes.length > 0 && (
                                <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                                    <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                                        Meus Perfis Favoritos
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {savedRecipes.map(r => (
                                            <div key={r.id} className="inline-flex items-center bg-purple-500/10 border border-purple-500/30 rounded-lg overflow-hidden">
                                                <button
                                                    type="button"
                                                    onClick={() => handleApplySavedRecipe(r)}
                                                    className="px-3 py-1.5 text-xs text-purple-200 hover:bg-purple-500/20 transition-colors font-medium"
                                                >
                                                    {r.name}
                                                </button>
                                                <button
                                                    type="button"
                                                    title={`Excluir perfil ${r.name}`}
                                                    onClick={() => handleDeleteSavedRecipe(r.id)}
                                                    className="px-2 py-1.5 text-purple-400 hover:text-red-400 hover:bg-red-500/10 transition-colors border-l border-purple-500/20"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
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
                                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                                        <div className="flex-1 md:w-28">
                                            <div className="text-[10px] text-neutral-500 uppercase font-bold ml-1 mb-1">Temp (°C)</div>
                                            <input 
                                                type="number" 
                                                value={isNaN(p.temperature) ? '' : p.temperature}
                                                onChange={(e) => handleUpdateStep(p.id, 'temperature', parseFloat(e.target.value))}
                                                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-white outline-none focus:border-neutral-600"
                                            />
                                        </div>
                                        <div className="flex-1 md:w-28">
                                            <div className="text-[10px] text-neutral-500 uppercase font-bold ml-1 mb-1">Tempo (Dias)</div>
                                            <input 
                                                type="number" 
                                                value={isNaN(p.duration) ? '' : p.duration}
                                                onChange={(e) => handleUpdateStep(p.id, 'duration', parseFloat(e.target.value))}
                                                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-white outline-none focus:border-neutral-600"
                                            />
                                        </div>
                                        <div className="flex-1 md:w-36" title="Opcional: Avança automaticamente para a próxima rampa quando o densímetro atingir esta gravidade (ex: 1.018)">
                                            <div className="text-[10px] text-purple-400 uppercase font-bold ml-1 mb-1">Avançar em SG (Opc.)</div>
                                            <input 
                                                type="number"
                                                step="0.001"
                                                placeholder="Ex: 1.018"
                                                value={p.triggerGravity !== undefined && !isNaN(p.triggerGravity) ? p.triggerGravity : ''}
                                                onChange={(e) => handleUpdateStep(p.id, 'triggerGravity', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500 font-mono text-sm"
                                            />
                                        </div>
                                        {profile.length > 1 && (
                                            <button
                                                type="button"
                                                aria-label={`Remover etapa ${p.name}`}
                                                title="Remover etapa"
                                                onClick={() => handleRemoveStep(p.id)}
                                                className="w-10 h-10 mt-5 rounded-lg flex items-center justify-center text-neutral-600 hover:text-red-500 hover:bg-neutral-800 transition-colors shrink-0"
                                            >
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
                            A sua receita <strong>{name || 'Sem Nome'} ({style})</strong> está configurada para durar um total de {profile.reduce((acc, curr) => acc + (isNaN(curr.duration) ? 0 : curr.duration), 0)} dias em {profile.length} rampas de temperatura.
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
                        disabled={step === 1 && (!name.trim() || !style)}
                        className="px-8 py-4 bg-white text-black font-bold rounded-2xl flex items-center gap-2 hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Próximo <ArrowRight size={20} />
                    </button>
                ) : (
                    <button 
                        type="button"
                        onClick={handleStart}
                        disabled={isStarting}
                        className="px-10 py-4 bg-green-500 text-black font-bold text-lg rounded-2xl flex items-center gap-3 hover:bg-green-400 hover:scale-105 transition-all shadow-[0_0_40px_rgba(34,197,94,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CheckCircle2 size={24} /> {isStarting ? 'INICIANDO...' : 'INICIAR FERMENTAÇÃO'}
                    </button>
                )}
            </div>
        </div>
    );
};
