import React, { useState } from 'react';
import { 
    Percent, 
    FlaskConical, 
    Pipette, 
    Scale, 
    Thermometer, 
    Beer, 
    ChevronRight,
    Calculator
} from 'lucide-react';
import { AbvCalculator } from './calculators/AbvCalculator';
import { RefractometerCalculator } from './calculators/RefractometerCalculator';
import { YeastCalculator } from './calculators/YeastCalculator';
import { BoilOffCalculator } from './calculators/BoilOffCalculator';
import { HydrometerTempCalculator } from './calculators/HydrometerTempCalculator';
import { CarbonationCalculator } from './calculators/CarbonationCalculator';

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
        color: 'text-blue-400 bg-blue-400/10'
    },
    {
        id: 'yeast',
        title: 'Taxa de Inoculação / Propagação',
        description: 'Calcule a quantidade ideal de levedura e starters necessários.',
        icon: FlaskConical,
        color: 'text-amber-400 bg-amber-400/10'
    },
    {
        id: 'refractometer',
        title: 'Refratômetro / Brix',
        description: 'Corrija leituras do refratômetro considerando o fator de correção e presença de álcool.',
        icon: Pipette,
        color: 'text-emerald-400 bg-emerald-400/10'
    },
    {
        id: 'density',
        title: 'Correção da Densidade / Evaporação',
        description: 'Ajuste o volume de fervura para atingir a OG desejada.',
        icon: Scale,
        color: 'text-purple-400 bg-purple-400/10'
    },
    {
        id: 'hydrometer',
        title: 'Correção de Temp. do Densímetro',
        description: 'Ajuste a leitura de densidade baseada na temperatura da amostra.',
        icon: Thermometer,
        color: 'text-red-400 bg-red-400/10'
    },
    {
        id: 'carbonation',
        title: 'Carbonatação',
        description: 'Calcule a pressão de CO2 ou quantidade de primming para o estilo.',
        icon: Beer,
        color: 'text-yellow-500 bg-yellow-500/10'
    }
];

export const BrewingCalculators: React.FC = () => {
    const [activeCalculator, setActiveCalculator] = useState<string | null>(null);

    return (
        <div className="w-full px-4 md:px-10 mx-auto pb-24">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-neutral-800 rounded-lg">
                        <Calculator className="text-white" size={24} />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tighter">Calculadoras</h1>
                </div>
                <p className="text-neutral-500">
                    Ferramentas essenciais para ajustes e cálculos precisos durante sua brassagem.
                </p>
            </div>

            {/* List */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden divide-y divide-neutral-800/50 shadow-2xl">
                {calculators.map((calc) => {
                    const Icon = calc.icon;
                    const isActive = activeCalculator === calc.id;
                    
                    return (
                        <div key={calc.id} className="w-full flex flex-col">
                            <button 
                                className={`w-full flex items-center justify-between p-5 hover:bg-neutral-800/50 transition-colors group text-left ${isActive ? 'bg-neutral-800/30' : ''}`}
                                onClick={() => {
                                    if (['abv', 'refractometer', 'yeast', 'density', 'hydrometer', 'carbonation'].includes(calc.id)) {
                                        setActiveCalculator(isActive ? null : calc.id);
                                    } else {
                                        alert(`A calculadora "${calc.title}" será implementada em breve!`);
                                    }
                                }}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl flex items-center justify-center ${calc.color} transition-transform group-hover:scale-110`}>
                                        <Icon size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold tracking-tight text-lg group-hover:text-neutral-200 transition-colors">{calc.title}</h3>
                                        <p className="text-neutral-500 text-sm mt-0.5 max-w-xl">{calc.description}</p>
                                    </div>
                                </div>
                                <div className={`text-neutral-600 transition-transform duration-300 ${isActive ? 'rotate-90 text-white' : 'group-hover:text-white group-hover:translate-x-1'}`}>
                                    <ChevronRight size={20} />
                                </div>
                            </button>
                            
                            {/* Accordion Content */}
                            {isActive && (
                                <div className="p-4 md:p-6 border-t border-neutral-800/50 animate-in fade-in slide-in-from-top-4 duration-300">
                                    {calc.id === 'abv' && <AbvCalculator />}
                                    {calc.id === 'refractometer' && <RefractometerCalculator />}
                                    {calc.id === 'yeast' && <YeastCalculator />}
                                    {calc.id === 'density' && <BoilOffCalculator />}
                                    {calc.id === 'hydrometer' && <HydrometerTempCalculator />}
                                    {calc.id === 'carbonation' && <CarbonationCalculator />}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};
