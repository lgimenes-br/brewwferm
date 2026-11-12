import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { 
    Percent, 
    FlaskConical, 
    Pipette, 
    Scale, 
    Thermometer, 
    Beer, 
    ChevronRight,
    Calculator,
    Compass
} from 'lucide-react';
import { AbvCalculator } from './calculators/AbvCalculator';
import { RefractometerCalculator } from './calculators/RefractometerCalculator';
import { YeastCalculator } from './calculators/YeastCalculator';
import { BoilOffCalculator } from './calculators/BoilOffCalculator';
import { HydrometerTempCalculator } from './calculators/HydrometerTempCalculator';
import { CarbonationCalculator } from './calculators/CarbonationCalculator';
import { ISpindelCalibrationCalculator } from './calculators/ISpindelCalibrationCalculator';

interface CalculatorItem {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
}

const calculators: CalculatorItem[] = [
    {
        id: 'abv',
        title: 'Álcool / Atenuação / Calorias',
        description: 'Estime o teor alcoólico (ABV), atenuação e calorias da sua cerveja.',
        icon: Percent,
        color: 'text-blue-600 bg-blue-400/10'
    },
    {
        id: 'yeast',
        title: 'Taxa de Inoculação / Propagação',
        description: 'Calcule a quantidade ideal de levedura e starters necessários.',
        icon: FlaskConical,
        color: 'text-[#b45309] bg-amber-500/15'
    },
    {
        id: 'refractometer',
        title: 'Refratômetro / Brix',
        description: 'Corrija leituras do refratômetro considerando o fator de correção e presença de álcool.',
        icon: Pipette,
        color: 'text-[#178a3f] bg-emerald-400/10'
    },
    {
        id: 'density',
        title: 'Correção da Densidade / Evaporação',
        description: 'Ajuste o volume de fervura para atingir a OG desejada.',
        icon: Scale,
        color: 'text-purple-600 bg-purple-400/10'
    },
    {
        id: 'hydrometer',
        title: 'Correção de Temp. do Densímetro',
        description: 'Ajuste a leitura de densidade baseada na temperatura da amostra.',
        icon: Thermometer,
        color: 'text-[#d63a4d] bg-red-400/10'
    },
    {
        id: 'carbonation',
        title: 'Carbonatação',
        description: 'Calcule a pressão de CO2 ou quantidade de primming para o estilo.',
        icon: Beer,
        color: 'text-[#a16207] bg-yellow-500/10'
    },
    {
        id: 'ispindel',
        title: 'Calibração Polinomial (iSpindel / Tilt)',
        description: 'Gere o polinômio de 2º ou 3º grau (R²) a partir dos ângulos de inclinação e densidades medidas.',
        icon: Compass,
        color: 'text-cyan-700 bg-cyan-400/10'
    }
];

export const BrewingCalculators: React.FC = () => {
    const [activeCalculator, setActiveCalculator] = useState<string | null>(null);

    return (
        <div className="w-full px-4 md:px-10 mx-auto pb-24">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-[var(--bg)] rounded-lg">
                        <Calculator className="text-[var(--ink)]" size={24} />
                    </div>
                    <h1 className="text-3xl font-semibold text-[var(--ink)] tracking-tighter">Calculadoras</h1>
                </div>
                <p className="text-[var(--muted)]">
                    Ferramentas essenciais para ajustes e cálculos precisos durante sua brassagem.
                </p>
            </div>

            {/* List */}
            <div className="bg-white border border-black/[0.07] rounded-2xl overflow-hidden divide-y divide-neutral-800/50 shadow-2xl">
                {calculators.map((calc) => {
                    const Icon = calc.icon;
                    const isActive = activeCalculator === calc.id;
                    
                    return (
                        <div key={calc.id} className="w-full flex flex-col">
                            <button 
                                type="button"
                                aria-expanded={isActive}
                                className={`w-full flex items-center justify-between p-5 hover:bg-[var(--bg)] transition-colors group text-left ${isActive ? 'bg-[var(--bg)]' : ''}`}
                                onClick={() => {
                                    if (['abv', 'refractometer', 'yeast', 'density', 'hydrometer', 'carbonation', 'ispindel'].includes(calc.id)) {
                                        setActiveCalculator(isActive ? null : calc.id);
                                    } else {
                                        toast(`A calculadora "${calc.title}" será implementada em breve!`);
                                    }
                                }}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl flex items-center justify-center ${calc.color} transition-transform group-hover:scale-110`}>
                                        <Icon size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-[var(--ink)] font-bold tracking-tight text-lg group-hover:text-[#2b2f37] transition-colors">{calc.title}</h3>
                                        <p className="text-[var(--muted)] text-sm mt-0.5 max-w-xl">{calc.description}</p>
                                    </div>
                                </div>
                                <div className={`text-black/40 transition-transform duration-300 ${isActive ? 'rotate-90 text-[var(--ink)]' : 'group-hover:text-[var(--ink)] group-hover:translate-x-1'}`}>
                                    <ChevronRight size={20} />
                                </div>
                            </button>
                            
                            {/* Accordion Content */}
                            {isActive && (
                                <div className="p-4 md:p-6 border-t border-black/[0.07] animate-in fade-in slide-in-from-top-4 duration-300">
                                    {calc.id === 'abv' && <AbvCalculator />}
                                    {calc.id === 'refractometer' && <RefractometerCalculator />}
                                    {calc.id === 'yeast' && <YeastCalculator />}
                                    {calc.id === 'density' && <BoilOffCalculator />}
                                    {calc.id === 'hydrometer' && <HydrometerTempCalculator />}
                                    {calc.id === 'carbonation' && <CarbonationCalculator />}
                                    {calc.id === 'ispindel' && <ISpindelCalibrationCalculator />}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};
