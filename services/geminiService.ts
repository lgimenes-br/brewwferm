/// <reference types="vite/client" />
import { Fermenter } from "../types";
import { API_URL } from "../config";

export interface AIUsage { used: number; limit: number | null }
export interface AIAnalysis {
  createdAt?: string;
  summary: string;
  health_score: number; // 0-100
  estimated_completion_days: number;
  risk_level: 'low' | 'medium' | 'high';
  insights: string[];
  ideal_curve: { hours: number; gravity: number }[];
  /** Desde 22/11/2026: analise por secoes (regras + explicacao da IA) */
  phase?: { key: string; label: string };
  style?: { key: string; label: string; temp: [number, number]; attenuation: [number, number] } | null;
  predicted_fg?: number | null;
  predicted_fg_days?: number | null;
  sections?: { key: string; title: string; items: string[]; note?: string | null }[];
  next_steps?: { text: string; why?: string; when?: string }[];
  source?: 'regras' | 'regras+ia';
}

/** Resposta do servidor para conta sem o plano Premium */
export const PREMIUM_REQUIRED = 'O Breww.AI faz parte do plano Premium. Fale com a gente para ativar na sua conta.';

export const getBrewingInsights = async (fermenter: Fermenter): Promise<AIAnalysis | string> => {
  const controller = new AbortController();
  // O servidor pode tentar mais de um modelo (ate ~55 s): o navegador espera um pouco mais que isso
  const timeoutId = setTimeout(() => controller.abort(), 75000);
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/ai/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        batchId: fermenter.batchId,
        beerName: fermenter.beerName,
        style: fermenter.style,
        status: fermenter.status,
        og: fermenter.og,
        volume: fermenter.volume,
        targetTemp: fermenter.targetTemp,
        gravity: fermenter.currentDevice?.gravity || 0
      }),
      signal: controller.signal
    });

    if (response.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'));
      throw new Error('Sessão expirada');
    }

    const rawData = await response.json().catch(() => ({}));
    if (response.status === 403 && rawData?.code === 'premium_required') {
      return PREMIUM_REQUIRED;
    }
    if (response.status === 429 && rawData?.code === 'daily_limit') {
      lastUsage = parseUsage(rawData.usage);
      return String(rawData.error || 'Limite de análises atingido. Tente de novo mais tarde.');
    }
    if (!response.ok) {
      throw new Error(rawData.error || `HTTP ${response.status}`);
    }

    let data: any = rawData;
    const candidateText = rawData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof candidateText === 'string') {
      const cleanedText = candidateText.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      data = JSON.parse(cleanedText);
    }

    lastUsage = parseUsage(rawData?.usage);
    return toAnalysis(data);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error?.name === 'AbortError' || /abort/i.test(String(error?.message))) {
      return 'A análise demorou demais para responder. Tente de novo em instantes.';
    }
    return `Erro técnico: ${error.message || "Falha desconhecida"}`;
  } finally {
    clearTimeout(timeoutId);
  }
};

const parseUsage = (u: any): AIUsage | undefined =>
  u && Number.isFinite(Number(u.used)) ? { used: Number(u.used), limit: u.limit === null ? null : Number(u.limit) } : undefined;

/** Uso do limite devolvido pela ultima chamada (para o cartao mostrar "3 de 10") */
let lastUsage: AIUsage | undefined;
export const getLastUsage = () => lastUsage;

const toAnalysis = (data: any): AIAnalysis => {
    return {
      createdAt: typeof data?.createdAt === 'string' ? data.createdAt : undefined,
      summary: typeof data?.summary === 'string' ? data.summary : 'Análise concluída.',
      health_score: Number.isFinite(Number(data?.health_score)) ? Math.min(100, Math.max(0, Number(data.health_score))) : 80,
      estimated_completion_days: Number.isFinite(Number(data?.estimated_completion_days)) ? Math.max(0, Number(data.estimated_completion_days)) : 0,
      risk_level: (data?.risk_level === 'low' || data?.risk_level === 'medium' || data?.risk_level === 'high') ? data.risk_level : 'low',
      insights: Array.isArray(data?.insights) ? data.insights.map((item: any) => String(item)) : [],
      ideal_curve: Array.isArray(data?.ideal_curve) ? data.ideal_curve : [],
      phase: data?.phase && typeof data.phase.label === 'string' ? { key: String(data.phase.key), label: data.phase.label } : undefined,
      style: data?.style && typeof data.style.label === 'string' ? data.style : null,
      predicted_fg: Number.isFinite(Number(data?.predicted_fg)) && data?.predicted_fg !== null ? Number(data.predicted_fg) : null,
      predicted_fg_days: Number.isFinite(Number(data?.predicted_fg_days)) && data?.predicted_fg_days !== null ? Number(data.predicted_fg_days) : null,
      sections: Array.isArray(data?.sections)
        ? data.sections
            .filter((sec: any) => sec && typeof sec.title === 'string')
            .map((sec: any) => ({ key: String(sec.key), title: sec.title, items: Array.isArray(sec.items) ? sec.items.map(String) : [], note: typeof sec.note === 'string' ? sec.note : null }))
        : undefined,
      next_steps: Array.isArray(data?.next_steps)
        ? data.next_steps.filter((st: any) => st && typeof st.text === 'string').map((st: any) => ({ text: st.text, why: typeof st.why === 'string' ? st.why : '', when: typeof st.when === 'string' ? st.when : '' }))
        : undefined,
      source: data?.source === 'regras+ia' ? 'regras+ia' : data?.source === 'regras' ? 'regras' : undefined,
    };
};

/** Ultima analise guardada do lote (sem gastar uma nova) e o uso do limite das ultimas 24 h */
export const fetchLastAnalysis = async (batchId: number | string): Promise<{ analysis: AIAnalysis | null; usage?: AIUsage }> => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/ai/analysis/${encodeURIComponent(String(batchId))}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) return { analysis: null };
  const data = await res.json().catch(() => ({}));
  return { analysis: data?.analysis ? toAnalysis(data.analysis) : null, usage: parseUsage(data?.usage) };
};
