/// <reference types="vite/client" />
import { Fermenter } from "../types";
import { API_URL } from "../config";

export interface AIAnalysis {
  summary: string;
  health_score: number; // 0-100
  estimated_completion_days: number;
  risk_level: 'low' | 'medium' | 'high';
  insights: string[];
  ideal_curve: { hours: number; gravity: number }[];
}

export const getBrewingInsights = async (fermenter: Fermenter): Promise<AIAnalysis | string> => {
  const filteredReadings = fermenter.readings
    ? fermenter.readings.filter((_, i) => i % 4 === 0).slice(-15).map(r => ({
        t: r.timestamp,
        grav: r.gravity,
        beerT: r.beerTemp,
        fridgeT: r.fridgeTemp,
        tgt: r.targetTemp
      }))
    : [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/ai/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        beerName: fermenter.beerName,
        style: fermenter.style,
        status: fermenter.status,
        og: fermenter.og,
        volume: fermenter.volume,
        targetTemp: fermenter.targetTemp,
        beerTemp: fermenter.currentDevice?.temperature || 0,
        fridgeTemp: fermenter.currentFridgeTemp || 0,
        gravity: fermenter.currentDevice?.gravity || 0,
        readings: filteredReadings
      }),
      signal: controller.signal
    });

    if (response.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'));
      throw new Error('Sessão expirada');
    }

    const rawData = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(rawData.error || `HTTP ${response.status}`);
    }

    let data: any = rawData;
    const candidateText = rawData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof candidateText === 'string') {
      const cleanedText = candidateText.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      data = JSON.parse(cleanedText);
    }

    return {
      summary: typeof data?.summary === 'string' ? data.summary : 'Análise concluída.',
      health_score: Number.isFinite(Number(data?.health_score)) ? Math.min(100, Math.max(0, Number(data.health_score))) : 80,
      estimated_completion_days: Number.isFinite(Number(data?.estimated_completion_days)) ? Math.max(0, Number(data.estimated_completion_days)) : 0,
      risk_level: (data?.risk_level === 'low' || data?.risk_level === 'medium' || data?.risk_level === 'high') ? data.risk_level : 'low',
      insights: Array.isArray(data?.insights) ? data.insights.map((item: any) => String(item)) : [],
      ideal_curve: Array.isArray(data?.ideal_curve) ? data.ideal_curve : []
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return `Erro técnico: ${error.message || "Falha desconhecida"}`;
  } finally {
    clearTimeout(timeoutId);
  }
};
