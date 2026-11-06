/// <reference types="vite/client" />
import { Fermenter } from "../types";

export interface AIAnalysis {
  summary: string;
  health_score: number; // 0-100
  estimated_completion_days: number;
  risk_level: 'low' | 'medium' | 'high';
  insights: string[];
  ideal_curve: { hours: number; gravity: number }[];
}

// Helper to find the best available model
const getBestModel = async (apiKey: string): Promise<string> => {
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listRes.json();

    if (!Array.isArray(listData?.models)) return 'gemini-2.0-flash'; // Fallback

    const availableModels = listData.models
      .filter((m: any) => typeof m?.name === 'string')
      .map((m: any) => m.name.replace('models/', ''));

    // Preference list: try to find these in order
    // Prioritizing 1.5-flash because 2.0-flash has a limit of 0 on some free tiers (e.g. in Brazil)
    const preferences = [
      'gemini-1.5-flash',
      'gemini-flash-latest',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-pro'
    ];

    for (const pref of preferences) {
      const found = availableModels.find((m: string) => m.includes(pref) || m === pref);
      if (found) return found;
    }

    // If none of preferences match, pick the first "flash" model, or just the first gemini model
    const anyGemini = availableModels.find((m: string) => m.includes('gemini'));
    return anyGemini || 'gemini-2.0-flash';

  } catch (e) {
    console.warn("Failed to list models, using fallback", e);
    return 'gemini-2.0-flash';
  }
};

export const getBrewingInsights = async (fermenter: Fermenter): Promise<AIAnalysis | string> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return "⚠️ Erro de Configuração: Chave de API do Gemini não encontrada. Adicione VITE_GEMINI_API_KEY ao arquivo .env";
  }

  // Downsample readings to avoid token limits, taking 1 reading every ~4 hours
  const filteredReadings = fermenter.readings ? fermenter.readings.filter((_, i) => i % 4 === 0).map(r => ({
    t: r.timestamp,
    grav: r.gravity,
    beerT: r.beerTemp,
    fridgeT: r.fridgeTemp,
    tgt: r.targetTemp
  })) : [];

  const promptText = `
    Aja como um Mestre Cervejeiro experiente e técnico. Analise os seguintes dados de fermentação para a cerveja "${fermenter.beerName}" (Estilo: ${fermenter.style}).
    
    Estado Atual: ${fermenter.status}
    OG: ${fermenter.og}
    Volume: ${fermenter.volume}L
    Target Temp (Setpoint): ${fermenter.targetTemp}°C
    
    Sensores Atuais:
    - Temp Mosto (Poço Termométrico): ${fermenter.currentDevice?.temperature || 0}°C
    - Temp Geladeira (Ambiente): ${fermenter.currentFridgeTemp || 0}°C
    - Gravidade Atual: ${fermenter.currentDevice?.gravity || 0}
    
    Histórico recente (amostra temporal):
    ${JSON.stringify(filteredReadings.slice(-15))} 
    
    REQUISITO DE SAÍDA:
    Você DEVE retornar APENAS um objeto JSON válido (sem markdown, sem \`\`\`json).
    Use o seguinte schema:
    {
      "summary": "Resumo executivo de 2 frases sobre o estado da fermentação.",
      "health_score": 85, // 0 a 100 baseado na saúde da levedura e controle de temp
      "estimated_completion_days": 2, // Estimativa de dias para terminar (número inteiro)
      "risk_level": "low", // "low", "medium", ou "high"
      "insights": ["Insight 1", "Insight 2", "Recomendação"],
      "ideal_curve": [ // Gere 5-7 pontos representando a curva de gravidade IDEAL para este estilo, começando da OG até a FG esperada
        { "hours": 0, "gravity": ${fermenter.og} },
        { "hours": 24, "gravity": ... },
        ...
        { "hours": 100, "gravity": ... }
      ]
    }

    Responda em Português do Brasil.
  `;

  try {
    // Dynamically resolve the best model
    const model = await getBestModel(apiKey);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: promptText
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `HTTP ${response.status}`);
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text === 'string' && text.trim().length > 0) {
      try {
        // Clean markdown code blocks if present (just in case model ignores instruction)
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanText);
        return {
          summary: typeof parsed?.summary === 'string' ? parsed.summary : 'Análise concluída.',
          health_score: Number.isFinite(Number(parsed?.health_score)) ? Math.min(100, Math.max(0, Number(parsed.health_score))) : 80,
          estimated_completion_days: Number.isFinite(Number(parsed?.estimated_completion_days)) ? Math.max(0, Number(parsed.estimated_completion_days)) : 0,
          risk_level: (parsed?.risk_level === 'low' || parsed?.risk_level === 'medium' || parsed?.risk_level === 'high') ? parsed.risk_level : 'low',
          insights: Array.isArray(parsed?.insights) ? parsed.insights.map((item: any) => String(item)) : [],
          ideal_curve: Array.isArray(parsed?.ideal_curve) ? parsed.ideal_curve : []
        } as AIAnalysis;
      } catch (e) {
        console.error("Failed to parse AI JSON:", e);
        throw new Error("A IA não retornou um formato JSON válido.");
      }
    } else {
      throw new Error("Resposta vazia da API");
    }

  } catch (error: any) {
    console.error("Gemini API Error:", error);

    if (error.message?.includes('API_KEY') || error.message?.includes('key') || String(error).includes("403")) {
      return "⚠️ Erro: Chave de API inválida ou não encontrada. Verifique o arquivo .env";
    }

    return `Erro técnico: ${error.message || "Falha desconhecida"}`;
  }
};