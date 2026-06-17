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

    if (!listData.models) return 'gemini-2.0-flash'; // Fallback

    const availableModels = listData.models.map((m: any) => m.name.replace('models/', ''));

    // Preference list: try to find these in order
    // Prioritizing stable 'latest' aliases which usually map to free-tier capable models
    const preferences = [
      'gemini-flash-latest', // Likely 1.5 Flash (Free Tier friendly)
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro-latest',
      'gemini-pro',
      'gemini-2.0-flash-lite', // Lighter 2.0 might have quota?
      'gemini-2.0-flash'
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
    console.log("Resolving best model via API...");
    const model = await getBestModel(apiKey);
    console.log(`Using resolved model: ${model}`);

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

    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
      const text = data.candidates[0].content.parts[0].text;
      try {
        // Clean markdown code blocks if present (just in case model ignores instruction)
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText) as AIAnalysis;
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