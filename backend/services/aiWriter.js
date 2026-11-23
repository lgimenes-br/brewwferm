// Breww.AI, parte de texto: um modelo gratuito (Groq, formato da OpenAI) le os fatos calculados pelas regras
// (batchAnalysis.js) e escreve como um mestre cervejeiro: resumo, uma explicacao por secao e o porque de cada
// proximo passo. Os numeros (saude, risco, previsao, fase) sao sempre os das regras.
// Sem chave, fora do ar ou lento: devolve null e o app mostra so a analise por regras.
// Trocar de servico (OpenRouter, Mistral, Cloudflare...) = AI_BASE_URL + AI_API_KEY + AI_MODELS no .env.

const BASE_URL = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1';
const API_KEY = () => process.env.AI_API_KEY || process.env.GROQ_API_KEY || '';
const MODELS = () => (process.env.AI_MODELS || 'openai/gpt-oss-120b,openai/gpt-oss-20b').split(',').map((m) => m.trim()).filter(Boolean);
const TIMEOUT_MS = 30000;
const SECTION_KEYS = ['fase', 'temperatura', 'fermentacao', 'equipamento'];

export const aiWriterEnabled = () => !!API_KEY();

const SYSTEM = `Você é um mestre cervejeiro experiente que acompanha, pelo controlador Breww, a fermentação de um cervejeiro caseiro brasileiro.
Você recebe os FATOS de um lote já calculados por regras (fase, estilo, temperaturas, densidade, previsão da densidade final, equipamento, diário, próximos passos) e escreve para a pessoa, em português do Brasil, tratando por "você".

Como escrever:
- Explique o que está acontecendo e POR QUÊ, ligando os fatos (ex.: a fase atual e a temperatura do estilo, a velocidade da densidade e o que o fermento está fazendo).
- Seja técnico e prático, como alguém que já fez centenas de lotes: o efeito no sabor (ésteres, diacetil, acetaldeído, álcoois superiores, atenuação, clareza) quando for relevante.
- Para cada problema, diga o efeito provável na cerveja se continuar assim e o que fazer para corrigir.
- Use só os fatos recebidos. Nunca invente números, datas, ingredientes, fermento ou problemas; se um dado não veio, não fale dele.
- Não contradiga os fatos nem a ordem dos próximos passos. Pode explicar melhor e dizer o momento certo, mas não crie passos novos que mudem o rumo.
- Frases curtas e diretas, sem emojis, sem markdown, sem repetir o mesmo número em várias seções.

Responda APENAS um JSON neste formato:
{"summary": "2 a 4 frases com o panorama do lote",
 "sections": {"fase": "1 a 3 frases", "temperatura": "1 a 3 frases", "fermentacao": "1 a 3 frases", "equipamento": "1 a 3 frases"},
 "next_steps": [{"text": "o que fazer (reescrito de um próximo passo recebido)", "why": "por que agora, em 1 frase"}]}
Deixe vazia ("") a seção sem fatos.`;

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * @param {object} input  { beer: {name, style, og, fg, volume}, analysis: resultado de analyzeFermentation }
 * @returns {Promise<{summary: string, sections: Record<string,string>, next_steps: {text,why}[], tips: string[], model: string} | null>}
 */
export const writeAnalysisText = async ({ beer, analysis }, { fetchImpl = fetch } = {}) => {
    const key = API_KEY();
    if (!key) return null;
    const payload = {
        cerveja: beer,
        fatos: {
            resumo_das_regras: analysis.summary,
            saude_0_a_100: analysis.health_score,
            risco: analysis.risk_level,
            fase: analysis.phase?.label,
            familia_de_estilo: analysis.style ? `${analysis.style.label} (fermenta em ${analysis.style.temp[0]}–${analysis.style.temp[1]} °C, atenuação típica ${analysis.style.attenuation[0]}–${analysis.style.attenuation[1]}%)` : 'não reconhecida',
            dias_para_terminar_o_perfil: analysis.estimated_completion_days,
            densidade_final_prevista_pela_curva: analysis.predicted_fg,
            dias_ate_estabilizar: analysis.predicted_fg_days,
            secoes: Object.fromEntries((analysis.sections || []).map((s) => [s.key, s.items])),
            proximos_passos: (analysis.next_steps || []).map((s) => s.text),
            medidas: medidasLegiveis(analysis.metrics),
        },
    };
    const deadline = Date.now() + TIMEOUT_MS;
    for (const model of MODELS()) {
        const left = deadline - Date.now();
        if (left < 3000) break;
        try {
            const res = await fetchImpl(`${BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                signal: AbortSignal.timeout(left),
                body: JSON.stringify({
                    model,
                    temperature: 0.4,
                    max_completion_tokens: 2000,
                    ...(model.includes('gpt-oss') ? { reasoning_effort: 'medium' } : {}),
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
            const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
            const summary = clean(parsed.summary, 900);
            if (!summary) continue;
            const sections = {};
            for (const k of SECTION_KEYS) { const t = clean(parsed.sections?.[k], 600); if (t) sections[k] = t; }
            const nextSteps = (Array.isArray(parsed.next_steps) ? parsed.next_steps : [])
                .map((s) => ({ text: clean(s?.text, 260), why: clean(s?.why, 260) }))
                .filter((s) => s.text).slice(0, 5);
            // Compatibilidade: versoes antigas liam "tips"
            const tips = (Array.isArray(parsed.tips) ? parsed.tips : []).map((t) => clean(t, 220)).filter(Boolean).slice(0, 3);
            return { summary, sections, next_steps: nextSteps, tips, model };
        } catch (e) {
            console.warn(`[AI] ${model}: ${e?.name === 'TimeoutError' ? 'demorou demais' : e?.message || e}`);
        }
    }
    return null;
};

// Nomes explicitos com unidade: o modelo confundia "desvio medio" com temperatura
function medidasLegiveis(m = {}) {
    const out = {};
    const put = (k, v) => { if (v !== undefined && v !== null) out[k] = v; };
    put('temperatura_atual_da_cerveja_C', m.currentTemp);
    put('temperatura_alvo_C', m.currentTarget);
    put('temperatura_media_da_cerveja_nas_ultimas_24h_C', m.avgTemp24h);
    put('alvo_medio_nas_ultimas_24h_C', m.avgTarget24h);
    put('distancia_media_do_alvo_nas_ultimas_24h_C', m.avgDeviation24h);
    put('percentual_do_tempo_no_alvo_nas_ultimas_24h', m.withinTarget24h);
    put('maior_distancia_do_alvo_nas_ultimas_24h_C', m.maxOvershoot24h);
    put('oscilacao_em_torno_do_alvo_C', m.swing24h);
    put('variacao_da_temperatura_C_por_hora', m.tempTrendPerHour);
    put('vezes_que_o_compressor_ligou_em_24h', m.coolStarts24h);
    put('vezes_que_o_aquecedor_ligou_em_24h', m.heatStarts24h);
    put('densidade_atual', m.gravity);
    put('variacao_da_densidade_por_dia', m.gravityPerDay);
    put('atenuacao_aparente_percentual', m.attenuation);
    put('minutos_desde_a_ultima_leitura', m.lastReadingMinutes);
    if (m.step) put('etapa_atual', `${m.step.name} (${m.step.index} de ${m.step.total}, alvo ${m.step.target} °C)`);
    return out;
}
