import React, { useState, useRef } from 'react';
import { Brain, Sparkles, Loader2, MessageSquare, Download, X, Maximize2, Activity, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import { Fermenter } from '../types';
import { getBrewingInsights, AIAnalysis } from '../services/geminiService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface GeminiAdvisorProps {
  fermenter: Fermenter;
  className?: string;
}

export const GeminiAdvisor: React.FC<GeminiAdvisorProps> = ({ fermenter, className = "" }) => {
  const [insight, setInsight] = useState<AIAnalysis | string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const modalContentRef = useRef<HTMLDivElement>(null);

  const handleAskAI = async () => {
    setLoading(true);
    const result = await getBrewingInsights(fermenter);
    // If we get a string back (error), keep it as string. If object, it's AIAnalysis.
    setInsight(result);
    setLoading(false);
    setIsModalOpen(true);
  };

  const handleDownloadPDF = async () => {
    if (!modalContentRef.current) return;

    try {
      const content = modalContentRef.current;

      const originalStyle = content.style.cssText;
      content.style.backgroundColor = '#0a0a0a';
      content.style.color = '#ffffff';
      content.style.padding = '40px';
      content.style.width = '1200px'; // Fixed width for consistent render

      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0a0a0a',
        width: 1200,
        windowWidth: 1200
      });

      content.style.cssText = originalStyle;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Analise_BrewwAI_${fermenter.beerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  // Helper to render health gauge
  const renderHealthGauge = (score: number) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = score > 80 ? '#10b981' : score > 50 ? '#f59e0b' : '#ef4444';

    return (
      <div className="relative flex items-center justify-center w-32 h-32">
        <svg className="transform -rotate-90 w-32 h-32">
          <circle
            className="text-neutral-800"
            strokeWidth="8"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="64"
            cy="64"
          />
          <circle
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx="64"
            cy="64"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-2xl font-bold text-white">{score}</span>
          <span className="text-xs text-neutral-400">SAÚDE</span>
        </div>
      </div>
    );
  };

  const isStructured = (data: any): data is AIAnalysis => {
    return data && typeof data === 'object' && 'health_score' in data;
  };

  const formatChartData = (data: AIAnalysis) => {
    // Merge ideal curve with real readings roughly
    // This is simplified. In a real app we'd map timestamps to hours more precisely.
    const realData = fermenter.readings.map((r, i) => ({
      name: `H${i * 4}`, // Assuming 4h gaps roughly
      real: r.gravity,
      ideal: null
    }));

    // Map ideal curve to the same x-axis if possible, or just overlay
    // For simplicity, let's just use the ideal curve as the base if provided
    if (!data.ideal_curve) return realData;

    return data.ideal_curve.map((p, i) => ({
      name: `H${p.hours}`,
      ideal: p.gravity,
      real: fermenter.readings[i] ? fermenter.readings[i].gravity : null
    }));
  };

  return (
    <>
      <div className={`bg-gradient-to-br from-neutral-900 to-black border border-neutral-800 rounded-xl p-6 shadow-lg relative overflow-hidden group hover:border-indigo-900/50 transition-colors flex flex-col ${className}`}>
        {/* Background decoration */}
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
          <Brain size={120} />
        </div>

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="text-white" size={20} />
              <h3 className="text-lg font-bold text-neutral-100">Breww.AI</h3>
            </div>
            {!insight ? (
              <button
                onClick={handleAskAI}
                disabled={loading}
                className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg transition-all disabled:opacity-50 text-sm font-medium border border-neutral-700"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <MessageSquare size={16} />}
                {loading ? "Analisando..." : "Analisar Fermentação"}
              </button>
            ) : (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-300 px-3 py-1.5 rounded-lg transition-all text-xs font-medium border border-indigo-500/30"
              >
                <Maximize2 size={14} />
                Ver Análise
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center items-center text-center">
            {insight ? (
              <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800 w-full text-left">
                <p className="text-neutral-400 text-sm line-clamp-3 italic">
                  "{isStructured(insight) ? insight.summary : String(insight).substring(0, 150) + '...'}"
                </p>
                <div className="mt-2 text-xs text-indigo-400 font-medium">
                  Clique em "Ver Análise" para ler dashboard completo.
                </div>
              </div>
            ) : (
              <p className="text-neutral-500 text-sm max-w-md">
                Utilize a inteligência artificial do Gemini para analisar as curvas de temperatura e gravidade, identificar paradas de fermentação e sugerir correções de perfil.
              </p>
            )}

          </div>
        </div>
      </div>

      {/* Analysis Modal */}
      {isModalOpen && insight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-950 border border-neutral-800 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col relative overflow-hidden">

            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-neutral-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <Sparkles className="text-indigo-400" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Análise Breww.AI</h2>
                  <p className="text-neutral-500 text-sm">Gerado via Gemini AI • {new Date().toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-neutral-200 rounded-lg font-medium text-sm transition-colors"
                >
                  <Download size={16} />
                  Baixar PDF
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Modal Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-black">
              <div ref={modalContentRef} className="p-8">

                {/* Header Info */}
                <div className="flex justify-between items-end mb-8 pb-6 border-b border-neutral-800">
                  <div>
                    <h1 className="text-3xl font-bold text-white mb-2">{fermenter.beerName}</h1>
                    <p className="text-neutral-400 text-lg">{fermenter.style} • Lote #{fermenter.batchId || fermenter.id || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-neutral-500">Status Atual</div>
                    <div className="text-xl text-white font-medium">{fermenter.status}</div>
                  </div>
                </div>

                {isStructured(insight) ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">

                    {/* Left Column: Metrics & Gauge */}
                    <div className="space-y-6">
                      <div className="bg-neutral-900/50 p-6 rounded-xl border border-neutral-800 flex flex-col items-center">
                        <h3 className="text-neutral-400 text-sm mb-4 font-medium uppercase tracking-wider">Saúde da Fermentação</h3>
                        {renderHealthGauge(insight.health_score)}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800">
                          <div className="text-neutral-400 text-xs mb-1 flex items-center gap-1"><Calendar size={12} /> EST. TÉRMINO</div>
                          <div className="text-2xl font-bold text-white">
                            {insight.estimated_completion_days} <span className="text-sm font-normal text-neutral-500">dias</span>
                          </div>
                        </div>
                        <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800">
                          <div className="text-neutral-400 text-xs mb-1 flex items-center gap-1"><AlertTriangle size={12} /> RISCO</div>
                          <div className={`text-xl font-bold capitalize ${insight.risk_level === 'high' ? 'text-red-500' :
                              insight.risk_level === 'medium' ? 'text-orange-500' : 'text-green-500'
                            }`}>
                            {insight.risk_level === 'low' ? 'Baixo' : insight.risk_level === 'medium' ? 'Médio' : 'Alto'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Middle Column: Chart */}
                    <div className="md:col-span-2 bg-neutral-900/50 p-6 rounded-xl border border-neutral-800">
                      <h3 className="text-neutral-400 text-sm mb-4 font-medium uppercase tracking-wider flex justify-between">
                        <span>Gravidade: Real vs. Ideal</span>
                        <span className="text-xs normal-case text-indigo-400">Linha Roxa: Ideal IA</span>
                      </h3>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={formatChartData(insight)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="name" stroke="#666" fontSize={12} />
                            <YAxis domain={['auto', 'auto']} stroke="#666" fontSize={12} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#111', borderColor: '#333' }}
                              itemStyle={{ color: '#fff' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Line type="monotone" dataKey="real" name="Gravidade Real" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="ideal" name="Curva Ideal (IA)" stroke="#818cf8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Bottom Row: Insights & Summary */}
                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-neutral-900/50 p-6 rounded-xl border border-neutral-800">
                        <h3 className="text-neutral-400 text-sm mb-4 font-medium uppercase tracking-wider flex items-center gap-2">
                          <CheckCircle size={16} className="text-indigo-400" /> Recomendações da IA
                        </h3>
                        <ul className="space-y-3">
                          {insight.insights.map((item, idx) => (
                            <li key={idx} className="text-neutral-300 text-sm leading-relaxed flex items-start gap-2">
                              <span className="text-indigo-500 mt-1">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-neutral-900/50 p-6 rounded-xl border border-neutral-800">
                        <h3 className="text-neutral-400 text-sm mb-4 font-medium uppercase tracking-wider flex items-center gap-2">
                          <Activity size={16} className="text-indigo-400" /> Resumo Breww.AI
                        </h3>
                        <p className="text-neutral-300 text-sm leading-relaxed italic">
                          "{insight.summary}"
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Fallback for error messages or raw strings
                  <div className="bg-neutral-900/50 p-6 rounded-xl border border-red-900/30 text-red-200">
                    <h3 className="font-bold mb-2 flex items-center gap-2">
                      <AlertTriangle size={20} /> Resposta não estruturada
                    </h3>
                    <p>{String(insight)}</p>
                  </div>
                )}

                <div className="mt-8 pt-8 border-t border-neutral-800 text-center text-neutral-500 text-sm italic">
                  Relatório Visual gerado em {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
