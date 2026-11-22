// Executar: cd backend && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFermentation, parseGravity } from '../services/batchAnalysis.js';
import { writeAnalysisText } from '../services/aiWriter.js';

const HOUR = 3600 * 1000;
const NOW = Date.UTC(2026, 10, 22, 20, 0, 0);
const PROFILE = [
    { name: 'Fermentação', temperature: 19.5, duration: 7, triggerGravity: 1.022 },
    { name: 'Descanso de diacetil', temperature: 16, duration: 3 },
    { name: 'Lagering', temperature: 1, duration: 10 },
];

/** n horas terminando agora; fn(i, horasAtras) devolve os campos da hora */
const series = (n, fn) => Array.from({ length: n }, (_, i) => {
    const ago = n - 1 - i;
    return { t: NOW - ago * HOUR, cooling: 0, heating: 0, ...fn(i, ago) };
});

const batch = (extra = {}) => ({
    name: 'Teste', style: 'Pilsner', og: '1.050', fg: '1.010', isActive: true,
    stepStartedAt: NOW - 3 * 24 * HOUR, currentStep: 0, isPaused: false, profile: PROFILE, ...extra,
});

test('densidade: aceita 1.05 e 1050, recusa valores fora da faixa (ex.: 32,87 de sensor ausente)', () => {
    assert.equal(parseGravity('1.05'), 1.05);
    assert.equal(parseGravity('1050'), 1.05);
    assert.equal(parseGravity('32.868'), null);
    assert.equal(parseGravity(''), null);
});

test('lote saudavel: no alvo, densidade caindo -> risco baixo, nota alta, previsao pela densidade', () => {
    const hourly = series(48, (i) => ({ temp: 19.5 + (i % 2 ? 0.1 : -0.1), target: 19.5, sg: 1.040 - i * 0.0002 }));
    const last = { at: NOW - 60 * 1000, temp: 19.5, target: 19.5, sg: hourly[47].sg };
    const r = analyzeFermentation({ batch: batch(), hourly, last, now: NOW });
    assert.equal(r.risk_level, 'low');
    assert.ok(r.health_score >= 90, `nota ${r.health_score}`);
    assert.ok(r.insights.some((t) => /no alvo em 100%/.test(t)));
    assert.ok(r.insights.some((t) => /cai 4,8 pontos por dia/.test(t)), r.insights.join(' | '));
    // etapa 1 avanca quando chegar a 1.022 (~2,5 dias) + 3 + 10 dias
    assert.ok(r.estimated_completion_days >= 15 && r.estimated_completion_days <= 16, `previsao ${r.estimated_completion_days}`);
    assert.ok(r.ideal_curve.length > 5 && r.ideal_curve[0].gravity > r.ideal_curve.at(-1).gravity);
});

test('resfriando sem efeito (caso real do lote 22: 29 °C com alvo de 1 °C) -> risco alto e aviso da geladeira', () => {
    const hourly = series(30, () => ({ temp: 29.6, target: 1, cooling: 1, sg: 32.868 }));
    const last = { at: NOW - 30 * 1000, temp: 29.6, target: 1, sg: 32.868 };
    const r = analyzeFermentation({ batch: batch({ currentStep: 2, stepStartedAt: NOW - 2 * 24 * HOUR }), hourly, last, now: NOW });
    assert.equal(r.risk_level, 'high');
    assert.ok(r.health_score < 50);
    assert.ok(r.insights.some((t) => /geladeira está ligada/.test(t)));
    assert.ok(r.insights.some((t) => /Sem densímetro/.test(t)), 'densidade invalida e ignorada');
});

test('rampa logo depois de trocar o alvo nao conta como erro de temperatura', () => {
    const hourly = series(8, (i) => ({ temp: 19.5 - i * 0.4, target: 16 }));
    const last = { at: NOW - 60 * 1000, temp: hourly[7].temp, target: 16 };
    const r = analyzeFermentation({ batch: batch({ currentStep: 1, stepStartedAt: NOW - 7 * HOUR }), hourly, last, now: NOW });
    assert.ok(r.insights.some((t) => /rampa/.test(t)));
    assert.ok(!r.insights.some((t) => /fora do alvo/.test(t)));
});

test('sem leituras ha mais de 15 min -> risco alto e aviso de energia/Wi-Fi', () => {
    const hourly = series(24, () => ({ temp: 19.5, target: 19.5 }));
    const last = { at: NOW - 3 * HOUR, temp: 19.5, target: 19.5 };
    const r = analyzeFermentation({ batch: batch(), hourly, last, now: NOW });
    assert.equal(r.risk_level, 'high');
    assert.ok(r.insights.some((t) => /não envia leituras há 3 h/.test(t)));
});

test('densidade parada acima da final na fermentacao -> aviso de fermentacao travada', () => {
    const hourly = series(48, () => ({ temp: 19.5, target: 19.5, sg: 1.030 }));
    const last = { at: NOW - 60 * 1000, temp: 19.5, target: 19.5, sg: 1.030 };
    const r = analyzeFermentation({ batch: batch(), hourly, last, now: NOW });
    assert.ok(r.insights.some((t) => /pode ter travado/.test(t)));
    assert.equal(r.risk_level, 'medium');
});

test('lote finalizado: previsao zero', () => {
    const r = analyzeFermentation({ batch: batch({ isActive: false }), hourly: [], last: null, now: NOW });
    assert.equal(r.estimated_completion_days, 0);
});

test('texto da IA: sem chave nao chama nada; com resposta valida, usa o texto; com erro, volta null', async () => {
    const analysis = analyzeFermentation({ batch: batch({ isActive: false }), hourly: [], last: null, now: NOW });
    const saved = { g: process.env.GROQ_API_KEY, a: process.env.AI_API_KEY };
    delete process.env.GROQ_API_KEY; delete process.env.AI_API_KEY;
    let called = false;
    assert.equal(await writeAnalysisText({ beer: {}, analysis }, { fetchImpl: async () => { called = true; } }), null);
    assert.equal(called, false);

    process.env.GROQ_API_KEY = 'teste';
    const ok = await writeAnalysisText({ beer: {}, analysis }, {
        fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ summary: 'Tudo certo.', tips: ['Dica 1', '', 'Dica 2', 'Dica 3', 'Dica 4'] }) } }] }) }),
    });
    assert.equal(ok.summary, 'Tudo certo.');
    assert.deepEqual(ok.tips, ['Dica 1', 'Dica 2', 'Dica 3']);

    const fail = await writeAnalysisText({ beer: {}, analysis }, { fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }) });
    assert.equal(fail, null);
    if (saved.g === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = saved.g;
    if (saved.a !== undefined) process.env.AI_API_KEY = saved.a;
});
