import React, { useMemo } from 'react';
import { Fermenter, Reading } from '../types';
import { Target, Activity, CheckCircle2, ArrowRight } from 'lucide-react';

interface ForecastingEngineProps {
  fermenter: Fermenter;
}

export const ForecastingEngine: React.FC<ForecastingEngineProps> = ({ fermenter }) => {
  const { og, fg, readings } = fermenter;

  const { progress, isStabilized, currentGravity, diff48h } = useMemo(() => {
    if (!readings || readings.length === 0) {
      return { progress: 0, isStabilized: false, currentGravity: og, diff48h: null };
    }

    // Sort by timestamp just in case
    const sortedReadings = [...readings].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const latestReading = sortedReadings[sortedReadings.length - 1];
    const latestGravity = parseFloat(String(latestReading.gravity));
    
    // Safety checks for NaN
    const safeOG = parseFloat(String(og)) || 1.050;
    const safeFG = parseFloat(String(fg)) || 1.010;
    const currentG = isNaN(latestGravity) ? safeOG : latestGravity;

    // Calculate apparent attenuation progress %
    // Formula: ((OG - SG) / (OG - FG)) * 100
    let prog = 0;
    if (safeOG > safeFG) {
      prog = ((safeOG - currentG) / (safeOG - safeFG)) * 100;
    }
    // Clamp between 0 and 100
    prog = Math.max(0, Math.min(100, prog));

    // 48 Hour Stabilization Check
    const latestTime = new Date(latestReading.timestamp).getTime();
    const fortyEightHoursAgo = latestTime - (48 * 60 * 60 * 1000);

    // Find reading closest to 48h ago, but it MUST be at least 40 hours ago to be considered valid
    const oldReading = sortedReadings.find(r => new Date(r.timestamp).getTime() >= fortyEightHoursAgo);
    
    // Alternatively, just get the reading that is exactly or just before 48h ago
    const reading48hAgo = [...sortedReadings].reverse().find(r => new Date(r.timestamp).getTime() <= fortyEightHoursAgo);

    let stabilized = false;
    let diff = null;

    if (reading48hAgo) {
      const oldGravity = parseFloat(String(reading48hAgo.gravity));
      if (!isNaN(oldGravity)) {
        diff = Math.abs(oldGravity - currentG);
        // If gravity varied by less than 0.002 points in 48h, it's considered stabilized
        if (diff <= 0.002 && prog > 80) { // Also require at least 80% expected attenuation to avoid false positives early on
          stabilized = true;
        }
      }
    }

    return {
      progress: prog,
      isStabilized: stabilized,
      currentGravity: currentG,
      diff48h: diff
    };
  }, [readings, og, fg]);

  return (
    <div className="w-full bg-neutral-900/40 p-6 rounded-3xl border border-neutral-800 backdrop-blur-sm">
      <h3 className="text-neutral-500 font-bold mb-4 text-xs uppercase tracking-widest pl-2 flex items-center gap-2">
        <Target size={14} />
        Previsão & Progresso
      </h3>
      
      <div className="flex flex-col md:flex-row items-center gap-6">
        
        {/* Progress Bar Section */}
        <div className="flex-1 w-full">
          <div className="flex justify-between items-end mb-2 px-1">
            <span className="text-sm font-bold text-white">Atenuação Aparente</span>
            <span className="text-xl font-mono text-white font-bold">{progress.toFixed(1)}<span className="text-sm text-neutral-500">%</span></span>
          </div>
          
          <div className="h-3 w-full bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
            <div 
              className="h-full bg-gradient-to-r from-purple-600 to-blue-500 rounded-full relative transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
            </div>
          </div>
          
          <div className="flex justify-between mt-2 px-1 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
            <span>OG: {Number(og).toFixed(3)}</span>
            <span>FG Alvo: {Number(fg).toFixed(3)}</span>
          </div>
        </div>

        {/* AI Insight / Suggestion Card */}
        <div className={`w-full md:w-1/3 p-4 rounded-2xl border transition-all duration-500 flex items-center gap-4 ${
          isStabilized 
            ? 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
            : 'bg-neutral-950/50 border-neutral-800'
        }`}>
          {isStabilized ? (
            <>
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-blue-400 font-bold text-xs uppercase tracking-widest mb-1">Estabilizado</p>
                <p className="text-neutral-300 text-[11px] leading-tight">Gravidade não variou nas últimas 48h. Sugestão: Avançar para Cold Crash.</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center shrink-0">
                <Activity size={20} className="text-neutral-500" />
              </div>
              <div>
                <p className="text-neutral-500 font-bold text-xs uppercase tracking-widest mb-1">Em Atividade</p>
                <p className="text-neutral-400 text-[11px] leading-tight">A fermentação segue ativa. Aguardando estabilização da densidade.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
