// Breww.AI, parte de texto: um modelo gratuito (Groq, formato da OpenAI) reescreve o resumo das regras
// e acrescenta ate 3 dicas praticas. Os numeros (saude, risco, previsao) sao sempre os das regras.
// Sem chave, fora do ar ou lento: devolve null e o app mostra so a analise por regras.
// Trocar de servico (OpenRouter, Mistral, Cloudflare...) = AI_BASE_URL + AI_API_KEY + AI_MODELS no .env.

const BASE_URL = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1';
const API_KEY = () => process.env.AI_API_KEY || process.env.GROQ_API_KEY || '';
const MODELS = () => (process.env.AI_MODELS || 'openai/gpt-oss-120b,openai/gpt-oss-20b').split(',').map((m) => m.trim()).filter(Boolean);
const TIMEOUT_MS = 15000;

export const aiWriterEnabled = () => !!API_KEY();

const SYSTEM = `Você é um mestre cervejeiro que acompanha a fermentação de um cervejeiro caseiro brasileiro.
Recebe a análise automática de um lote (já calculada) e escreve para a pessoa, em português do Brasil, tratando por "você".
Regras: use só os dados recebidos; não invente números, datas, ingredientes nem problemas; não contradiga a análise;
frases curtas e diretas, sem jargão desnecessário, sem emojis.
Responda APENAS um JSON: {"summary": "até 3 frases", "tips": ["até 3 dicas práticas, cada uma com até 25 palavras"]}.`;

// Nomes explicitos com unidade: o modelo confundia "desvio medio" com temperatura
const medidasLegiveis = (m = {}) => {
    const out = {};
    const put = (k, v) => { if (v !== undefined && v !== null) out[k] = v; };
    put('temperatura_atual_da_cerveja_C', m.currentTemp);
    put('temperatura_alvo_C', m.currentTarget);
    put('distancia_media_do_alvo_nas_ultimas_24h_C', m.avgDeviation24h);
    put('percentual_do_tempo_no_alvo_nas_ultimas_24h', m.withinTarget24h);
    put('variacao_da_temperatura_C_por_hora', m.tempTrendPerHour);
    put('densidade_atual', m.gravity);
    put('variacao_da_densidade_por_dia', m.gravityPerDay);
    put('atenuacao_aparente_percentual', m.attenuation);
    put('minutos_desde_a_ultima_leitura', m.lastReadingMinutes);
    if (m.step) put('etapa_atual', `${m.step.name} (${m.step.index} de ${m.step.total}, alvo ${m.step.target} °C)`);
    return out;
};

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * @param {object} input  { beer: {name, style, og, fg, volume}, analysis: resultado de analyzeFermentation }
 * @returns {Promise<{summary: string, tips: string[], model: string} | null>}
 */
export const writeAnalysisText = async ({ beer, analysis }, { fetchImpl = fetch } = {}) => {
    const key = API_KEY();
    if (!key) return null;
    const payload = {
        cerveja: beer,
        analise: {
            resumo: analysis.summary,
            saude: analysis.health_score,
            risco: analysis.risk_level,
            dias_para_terminar_o_perfil: analysis.estimated_completion_days,
            observacoes: analysis.insights,
            medidas: medidasLegiveis(analysis.metrics),
        },
    };
    const deadline = Date.now() + TIMEOUT_MS;
    for (const model of MODELS()) {
        const left = deadline - Date.now();
        if (left < 2000) break;
        try {
            const res = await fetchImpl(`${BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                signal: AbortSignal.timeout(left),
                body: JSON.stringify({
                    model,
                    temperature: 0.3,
                    max_completion_tokens: 600,
                    ...(model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}),
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: SYSTEM },
                        { role: 'user', content: JSON.stringify(payload) },
                    ],
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.warn(`[AI] ${model}: HTTP ${res.status} ${err?.error?.message || ''}`.trim());
                continue;
            }
            const data = await res.json();
            const text = data?.choices?.[0]?.message?.content;
            const parsed = JSON.parse(text || '{}');
            const summary = clean(parsed.summary, 600);
            if (!summary) continue;
            const tips = (Array.isArray(parsed.tips) ? parsed.tips : []).map((t) => clean(t, 220)).filter(Boolean).slice(0, 3);
            return { summary, tips, model };
        } catch (e) {
            console.warn(`[AI] ${model}: ${e?.name === 'TimeoutError' ? 'demorou demais' : e?.message || e}`);
        }
    }
    return null;
};
