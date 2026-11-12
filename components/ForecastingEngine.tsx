import React, { useMemo } from 'react';
import { Fermenter } from '../types';
import { Activity, CheckCircle2 } from 'lucide-react';

interface ForecastingEngineProps {
  fermenter: Fermenter;
}

export const ForecastingEngine: React.FC<ForecastingEngineProps> = ({ fermenter }) => {
  const { og, fg, readings } = fermenter || ({} as Fermenter);

  const { progress, isStabilized } = useMemo(() => {
    const validReadings = (Array.isArray(readings) ? readings : []).filter(r => {
      const g = parseFloat(String(r?.gravity));
      return !isNaN(g) && g > 0;
    });

    if (validReadings.length === 0) {
      return { progress: 0, isStabilized: false };
    }

    // Sort by timestamp just in case
    const sortedReadings = [...validReadings].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const latestReading = sortedReadings[sortedReadings.length - 1];
    const latestGravity = parseFloat(String(latestReading.gravity));
    
    // Safety checks for NaN
    const safeOG = parseFloat(String(og)) || 1.050;
    const safeFG = parseFloat(String(fg)) || 1.010;
    const currentG = isNaN(latestGravity) || latestGravity <= 0 ? safeOG : latestGravity;

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

    // Get the reading that is at or just before 48h ago
    const reading48hAgo = [...sortedReadings].reverse().find(r => new Date(r.timestamp).getTime() <= fortyEightHoursAgo);

    let stabilized = false;

    if (reading48hAgo) {
      const oldGravity = parseFloat(String(reading48hAgo.gravity));
      if (!isNaN(oldGravity) && oldGravity > 0) {
        const diff = Math.abs(oldGravity - currentG);
        // If gravity varied by less than 0.002 points in 48h, it's considered stabilized
        if (diff <= 0.002 && prog > 80) { // Also require at least 80% expected attenuation to avoid false positives early on
          stabilized = true;
        }
      }
    }

    return {
      progress: prog,
      isStabilized: stabilized
    };
  }, [readings, og, fg]);

  return (
    <div className="w-full bg-white p-6 rounded-3xl border border-black/[0.07] backdrop-blur-sm">

      
      <div className="flex flex-col md:flex-row items-center gap-6">
        
        {/* Progress Bar Section */}
        <div className="flex-1 w-full">
          <div className="flex justify-between items-end mb-2 px-1">
            <span className="text-sm font-bold text-[var(--ink)]">Atenuação Aparente</span>
            <span className="text-xl font-mono text-[var(--ink)] font-bold">{progress.toFixed(1)}<span className="text-sm text-[var(--muted)]">%</span></span>
          </div>
          
          <div
            role="progressbar"
            aria-label="Progresso de atenuação aparente"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-3 w-full bg-[var(--bg)] rounded-full overflow-hidden border border-black/[0.07]"
          >
            <div 
              className="h-full bg-[var(--accent)] rounded-full relative transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
            </div>
          </div>
          
          <div className="flex justify-between mt-2 px-1 text-[10px] font-mono text-[var(--muted)] ">
            <span>OG: {(Number(og) || 0).toFixed(3)}</span>
            <span>FG Alvo: {fg ? Number(fg).toFixed(3) : '-'}</span>
          </div>
        </div>

        {/* AI Insight / Suggestion Card */}
        <div className={`w-full md:w-1/3 p-4 rounded-2xl border transition-all duration-500 flex items-center gap-4 ${
          isStabilized 
            ? 'bg-blue-50 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
            : 'bg-[var(--bg)] border-black/[0.07]'
        }`}>
          {isStabilized ? (
            <>
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-blue-600 font-bold text-xs mb-1">Estabilizado</p>
                <p className="text-[#2b2f37] text-[11px] leading-tight">Gravidade não variou nas últimas 48h. Sugestão: Avançar para Cold Crash.</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                <Activity size={20} className="text-[var(--muted)]" />
              </div>
              <div>
                <p className="text-[var(--muted)] font-bold text-xs mb-1">Em Atividade</p>
                <p className="text-[var(--muted)] text-[11px] leading-tight">A fermentação segue ativa. Aguardando estabilização da densidade.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
