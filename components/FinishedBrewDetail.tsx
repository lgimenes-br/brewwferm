
import React, { useEffect, useState } from 'react';
import { FinishedBrew, Reading } from '../types';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { Award, Share2, FileDown, Quote, CheckCircle, Loader2, Save } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { toast } from 'react-hot-toast';
import { TemperatureChart } from './TemperatureChart';
import { GravityChart } from './GravityChart';

interface FinishedBrewDetailProps {
  brew: FinishedBrew;
}

export const FinishedBrewDetail: React.FC<FinishedBrewDetailProps> = ({ brew }) => {
  const { token } = useAuth();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = React.useState(false);

  const [activeTab, setActiveTab] = useState<'telemetry' | 'recipe'>('telemetry');
  const [ingredients, setIngredients] = useState<any>(brew.ingredients || {
    malts: '',
    hops: '',
    yeast: '',
    notes: brew.notes || ''
  });
  const [savingIng, setSavingIng] = useState(false);

  useEffect(() => {
    console.log("FinishedBrewDetail mounted - brew:", { id: brew.id, og: brew.og, fg: brew.fg, abv: brew.abv, readingsCount: brew.readings?.length || 0 });
    // Prevent infinite loop - only run once
    if (!token) {
      setLoading(false);
      return;
    }

    // If brew already has readings, use them and don't fetch again
    if (brew.readings && brew.readings.length > 0) {
      setReadings(brew.readings);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadDetails = async () => {
      try {
        console.log('Fetching batch data for ID:', brew.id);

        // Add timeout to prevent infinite loading
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const res = await fetch(`${API_URL}/batch/${brew.id}/data`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!isMounted) return;

        console.log('Response status:', res.status);

        if (res.ok) {
          const logs = await res.json();
          console.log('Received logs:', logs.length, 'entries');
          if (logs.length > 0) console.log('Sample log:', logs[0]);


          if (!isMounted) return;

          const parsedReadings: Reading[] = logs.map((l: any) => ({
            timestamp: l.recorded_at,
            beerTemp: parseFloat(l.temp_ferm) || 0,
            fridgeTemp: parseFloat(l.temp_amb) || 0,
            targetTemp: parseFloat(l.target_temp) || 0,
            gravity: parseFloat(l.gravity) || 0
          }));

          console.log('Parsed readings:', parsedReadings.length, 'entries');

          // DOWNSAMPLING: Limit to ~500 points for performance
          // 32k points crashes the SVG renderer or makes it empty
          const targetPoints = 500;
          let finalReadings = parsedReadings;

          if (parsedReadings.length > targetPoints) {
            const step = Math.ceil(parsedReadings.length / targetPoints);
            finalReadings = parsedReadings.filter((_, index) => index % step === 0);
            console.log(`Downsampling: Reduced from ${parsedReadings.length} to ${finalReadings.length} points (Step: ${step})`);
          }

          setReadings(finalReadings);
        } else {
          console.error('Failed to fetch batch data:', res.status, res.statusText);
        }
      } catch (e: any) {
        if (!isMounted) return;

        if (e.name === 'AbortError') {
          console.error('Request timeout - took longer than 10 seconds');
        } else {
          console.error('Error loading batch details:', e);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDetails();

    return () => {
      isMounted = false;
    };
  }, [brew.id, token]); // Only re-run if brew.id or token changes

  const attenuation = (brew.og && brew.fg && brew.og > 1)
    ? ((brew.og - brew.fg) / (brew.og - 1)) * 100
    : 0;
  const calories = (brew.abv && brew.fg)
    ? (brew.abv * 2.5) * (brew.fg * 10)
    : 0;


  const saveIngredients = async () => {
    setSavingIng(true);
    try {
      const res = await fetch(`${API_URL}/batches/${brew.id}/ingredients`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ingredients })
      });
      if (res.ok) toast.success('Receita salva com sucesso');
      else toast.error('Erro ao salvar receita');
    } catch (e) {
      toast.error('Erro ao salvar');
    } finally {
      setSavingIng(false);
    }
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('pdf-content');
    if (!element) return;
    toast.loading('Gerando PDF...', { id: 'pdf' });
    try {
      // Temporary hide UI elements not for PDF
      const noPrintElements = document.querySelectorAll('.no-print');
      noPrintElements.forEach(el => (el as HTMLElement).style.display = 'none');
      
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#0a0a0a' });
      
      noPrintElements.forEach(el => (el as HTMLElement).style.display = '');

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Relatorio_${brew.beerName}.pdf`);
      toast.success('PDF Exportado!', { id: 'pdf' });
    } catch (e) {
      toast.error('Erro ao gerar PDF', { id: 'pdf' });
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Lote ${brew.batchNumber} - ${brew.beerName}`,
      text: `Confira minha ${brew.beerName} (${brew.style}). ABV: ${brew.abv.toFixed(1)}%, FG: ${brew.fg.toFixed(3)}. Analisado no BREWW Dashboard!`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Erro ao compartilhar:", err);
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const StatCard = ({ label, value, subtext, colorClass }: any) => (
    <div className="bg-neutral-900/20 rounded-2xl p-6 border border-neutral-800/50 hover:border-neutral-700 transition-colors">
      <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-4xl font-light tracking-tighter ${colorClass}`}>{value}</p>
      {subtext && <p className="text-neutral-600 text-xs mt-1">{subtext}</p>}
    </div>
  );

  return (
    <div id="pdf-content" className="p-6 md:px-10 w-full mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300 pb-16 bg-[#0a0a0a] min-h-screen text-white">
      <div className="flex justify-end items-center mb-8 no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-xl border border-neutral-800 transition-all text-xs font-bold uppercase tracking-wider"
          >
            {copied ? <CheckCircle size={14} className="text-green-500" /> : <Share2 size={14} />}
            {copied ? 'Copiado' : 'Compartilhar'}
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-white text-black rounded-xl transition-all text-xs font-bold uppercase tracking-wider"
          >
            <FileDown size={14} />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-neutral-500 text-sm font-mono tracking-widest">{brew.batchNumber}</span>
          <span className="h-px w-8 bg-neutral-800"></span>
          <span className="text-neutral-500 text-sm font-light">{new Date(brew.endDate).toLocaleDateString()}</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter mb-2">{brew.beerName || 'Sem Nome'}</h1>
            <span className="inline-block px-3 py-1 bg-neutral-900 text-neutral-400 rounded-md text-sm border border-neutral-800">
              {brew.style}
            </span>
          </div>

          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <Award
                key={i}
                size={20}
                className={i < (brew.rating || 0) ? "text-white fill-white/20" : "text-neutral-800"}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid - Matching Reference */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {/* Duração */}
        <div className="bg-neutral-900/40 p-4 rounded-xl border border-neutral-800 backdrop-blur-sm flex flex-col justify-center items-center">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">Duração</span>
          <span className="text-xl font-mono text-orange-500 font-medium">
            {(() => {
              const start = new Date(brew.startDate).getTime();
              const end = new Date(brew.endDate).getTime();
              const diff = end - start;
              const days = Math.floor(diff / (1000 * 60 * 60 * 24));
              const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
              return `${days}d ${hours}h`;
            })()}
          </span>
        </div>

        {/* ABV Est. */}
        <div className="bg-neutral-900/40 p-4 rounded-xl border border-neutral-800 backdrop-blur-sm flex flex-col justify-center items-center">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">ABV Est.</span>
          <span className="text-xl font-mono text-green-500 font-medium">
            {brew.abv.toFixed(1)}%
          </span>
        </div>

        {/* OG Inicial */}
        <div className="bg-neutral-900/40 p-4 rounded-xl border border-neutral-800 backdrop-blur-sm flex flex-col justify-center items-center">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">OG Inicial</span>
          <span className="text-xl font-mono text-white font-medium">
            {brew.og.toFixed(3)}
          </span>
        </div>

        {/* FG Final */}
        <div className="bg-neutral-900/40 p-4 rounded-xl border border-neutral-800 backdrop-blur-sm flex flex-col justify-center items-center">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">FG Final</span>
          <span className="text-xl font-mono text-white font-medium">
            {brew.fg.toFixed(3)}
          </span>
        </div>

        {/* Max Temp */}
        <div className="bg-neutral-900/40 p-4 rounded-xl border border-neutral-800 backdrop-blur-sm flex flex-col justify-center items-center">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">Máx Temp</span>
          <span className="text-xl font-mono text-red-500 font-medium">
            {readings.length > 0
              ? Math.max(...readings.map(r => r.beerTemp)).toFixed(1)
              : '0.0'}°C
          </span>
        </div>

        {/* Min Temp */}
        <div className="bg-neutral-900/40 p-4 rounded-xl border border-neutral-800 backdrop-blur-sm flex flex-col justify-center items-center">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">Min Temp</span>
          <span className="text-xl font-mono text-blue-500 font-medium">
            {readings.length > 0
              ? Math.min(...readings.filter(r => r.beerTemp > 0).map(r => r.beerTemp)).toFixed(1)
              : '0.0'}°C
          </span>
        </div>
      </div>
      {/* Notes Quote */}
      {brew.notes && (
        <div className="relative bg-neutral-900/20 rounded-2xl p-8 mb-12 border border-neutral-800/50">
          <Quote className="absolute top-6 left-6 text-neutral-800 transform -scale-x-100 opacity-50" size={48} />
          <p className="relative z-10 text-xl font-light text-neutral-300 italic text-center max-w-3xl mx-auto leading-relaxed">
            "{brew.notes}"
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-neutral-800 mb-8 mt-12 no-print">
        <button 
          onClick={() => setActiveTab('telemetry')}
          className={`pb-4 px-4 text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'telemetry' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          Telemetria
        </button>
        <button 
          onClick={() => setActiveTab('recipe')}
          className={`pb-4 px-4 text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'recipe' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          Receita & Ingredientes
        </button>
      </div>

      {activeTab === 'recipe' ? (
        <div className="bg-neutral-900/20 rounded-2xl p-8 border border-neutral-800/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Maltes / Fermentáveis</label>
              <textarea 
                value={ingredients.malts}
                onChange={e => setIngredients({...ingredients, malts: e.target.value})}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white min-h-[120px] focus:outline-none focus:border-orange-500 transition-colors"
                placeholder="Ex: 5kg Pilsen, 500g Caramunich..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Lúpulos</label>
              <textarea 
                value={ingredients.hops}
                onChange={e => setIngredients({...ingredients, hops: e.target.value})}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white min-h-[120px] focus:outline-none focus:border-orange-500 transition-colors"
                placeholder="Ex: 20g Citra (60 min), 50g Mosaic (Dry Hop)..."
              />
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Levedura</label>
            <input 
              value={ingredients.yeast}
              onChange={e => setIngredients({...ingredients, yeast: e.target.value})}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white focus:outline-none focus:border-orange-500 transition-colors"
              placeholder="Ex: US-05 Fermentis"
            />
          </div>
          <div className="mb-8">
            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Anotações do Lote</label>
            <textarea 
              value={ingredients.notes}
              onChange={e => setIngredients({...ingredients, notes: e.target.value})}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white min-h-[120px] focus:outline-none focus:border-orange-500 transition-colors"
              placeholder="Ex: Mostura a 65°C por 60 minutos, fervura vigorosa..."
            />
          </div>
          
          <button 
            onClick={saveIngredients}
            disabled={savingIng}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-black px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-sm transition-colors no-print"
          >
            {savingIng ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Salvar Receita
          </button>
        </div>
      ) : (
        <>
          {loading ? (
            <div className="p-12 text-center text-neutral-500">
              <Loader2 className="animate-spin mx-auto mb-2" />
              Carregando dados de telemetria...
            </div>
          ) : readings.length === 0 ? (
            <div className="p-12 text-center bg-neutral-900/20 rounded-2xl border border-neutral-800 border-dashed">
              <p className="text-neutral-500 mb-2">📊 Sem dados de telemetria disponíveis</p>
              <p className="text-neutral-600 text-sm">
                Este lote não possui registros de temperatura e gravidade salvos durante a fermentação.
              </p>
              <p className="text-neutral-700 text-xs mt-2">
                Batch ID: {brew.id} | Tentou buscar de: /api/batch/{brew.id}/data
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 text-center text-neutral-600 text-xs">
                {readings.length} leituras de telemetria carregadas
              </div>
              <div className="grid grid-cols-1 gap-8 min-w-0">
                <div className="space-y-4 min-w-0">
                  <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-widest pl-2">Perfil de Temperatura</h3>
                  <TemperatureChart data={readings} />
                </div>
                <div className="space-y-4 min-w-0">
                  <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-widest pl-2">Curva de Atenuação</h3>
                  <GravityChart data={readings} og={brew.og} fg={brew.fg} />
                </div>
              </div>
            </>
          )}
        </>
      )}

      <div className="mt-16 pt-8 border-t border-neutral-900 flex justify-center text-xs text-neutral-600 font-mono uppercase tracking-widest">
        Tempo Total de Fermentação: {Math.ceil((new Date(brew.endDate).getTime() - new Date(brew.startDate).getTime()) / (1000 * 3600 * 24))} dias
      </div>
    </div>
  );
};
