import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAlertConfig, alertEnabled, inQuietHours, createNotifier, detectStable, DEFAULT_ALERT_CONFIG } from '../services/alerts.js';

// 02:30 UTC = 23:30 em Sao Paulo (UTC-3)
const at = (iso) => new Date(iso);

test('regras: padrao com todos os avisos ligados e silencio desligado', () => {
    const c = normalizeAlertConfig({});
    assert.equal(c.stableEnabled, true);
    assert.equal(c.compressorEnabled, true);
    assert.equal(c.quietEnabled, false);
    assert.equal(c.offlineDelayMin, 10);
    assert.equal(c.sgTargetValue, null);
});

test('regras: app antigo (so 3 alertas) nao apaga as escolhas novas', () => {
    const saved = normalizeAlertConfig({ stableEnabled: false, quietEnabled: true, offlineDelayMin: 30 });
    const fromOldApp = { lowBatteryEnabled: true, lowBatteryThreshold: 3.4, tempDeviationEnabled: false, tempDeviationMargin: 1, sgTargetEnabled: true, sgTargetValue: null, telegramBotToken: 'x' };
    const c = normalizeAlertConfig(fromOldApp, saved);
    assert.equal(c.stableEnabled, false);
    assert.equal(c.quietEnabled, true);
    assert.equal(c.offlineDelayMin, 30);
    assert.equal(c.tempDeviationEnabled, false);
    assert.equal(c.lowBatteryThreshold, 3.4);
    assert.equal('telegramBotToken' in c, false, 'campo antigo nao e guardado');
});

test('regras: valores invalidos voltam ao padrao', () => {
    const c = normalizeAlertConfig({ offlineDelayMin: 7, quietStart: '25:00', quietEnd: 'x', timeZone: 'Marte/Base', sgTargetValue: 1012, tempDeviationMargin: 99 });
    assert.equal(c.offlineDelayMin, 10);
    assert.equal(c.quietStart, '23:00');
    assert.equal(c.quietEnd, '07:00');
    assert.equal(c.timeZone, 'America/Sao_Paulo');
    assert.equal(c.sgTargetValue, 1.012, 'aceita 1012 e converte');
    assert.equal(c.tempDeviationMargin, 10);
});

test('tipo desligado nao envia; sensor_back segue o sensor_lost', () => {
    const c = normalizeAlertConfig({ sensorLostEnabled: false });
    assert.equal(alertEnabled(c, 'sensor_lost'), false);
    assert.equal(alertEnabled(c, 'sensor_back'), false);
    assert.equal(alertEnabled(c, 'stable'), true);
    assert.equal(alertEnabled(c, 'tipo_da_plataforma'), true);
});

test('horario de silencio passando da meia-noite, no fuso da pessoa', () => {
    const c = normalizeAlertConfig({ quietEnabled: true, quietStart: '23:00', quietEnd: '07:00', timeZone: 'America/Sao_Paulo' });
    assert.equal(inQuietHours(c, at('2026-11-24T02:30:00Z')), true);  // 23:30 local
    assert.equal(inQuietHours(c, at('2026-11-24T09:59:00Z')), true);  // 06:59 local
    assert.equal(inQuietHours(c, at('2026-11-24T10:00:00Z')), false); // 07:00 local
    assert.equal(inQuietHours(c, at('2026-11-24T18:00:00Z')), false); // 15:00 local
    assert.equal(inQuietHours({ ...c, quietEnabled: false }, at('2026-11-24T02:30:00Z')), false);
    const day = normalizeAlertConfig({ quietEnabled: true, quietStart: '13:00', quietEnd: '14:00' });
    assert.equal(inQuietHours(day, at('2026-11-24T16:30:00Z')), true); // 13:30 local
});

test('no silencio: urgente passa, o resto vira um resumo quando o silencio acaba', async () => {
    let clock = at('2026-11-24T02:30:00Z'); // 23:30 local
    const cfg = normalizeAlertConfig({ quietEnabled: true });
    const sent = [];
    const n = createNotifier({ getConfig: async () => cfg, send: async (u, t, b) => sent.push({ u, t, b }), now: () => clock });
    assert.equal(await n.notify(1, 'temp_out', 'Alerta de Temperatura', 'fora'), 'sent');
    assert.equal(await n.notify(1, 'step_change', 'Mudança de Passo', 'Maturação'), 'held');
    assert.equal(await n.notify(1, 'stable', 'Fermentação estabilizou', 'parada'), 'held');
    assert.equal(sent.length, 1);
    await n.flush();
    assert.equal(sent.length, 1, 'ainda no silencio');
    clock = at('2026-11-24T10:05:00Z'); // 07:05 local
    await n.flush();
    assert.equal(sent.length, 2);
    assert.equal(sent[1].t, '2 avisos durante o horário de silêncio');
    assert.match(sent[1].b, /Mudança de Passo: Maturação/);
    assert.match(sent[1].b, /Fermentação estabilizou: parada/);
    await n.flush();
    assert.equal(sent.length, 2, 'nao repete');
});

test('aviso desligado nem entra no resumo', async () => {
    const cfg = normalizeAlertConfig({ stepChangeEnabled: false });
    const sent = [];
    const n = createNotifier({ getConfig: async () => cfg, send: async (u, t) => sent.push(t) });
    assert.equal(await n.notify(1, 'step_change', 'x', 'y'), 'off');
    assert.equal(sent.length, 0);
});

// Leituras a cada 2 h nas ultimas 48 h
const serie = (fn) => Array.from({ length: 25 }, (_, i) => ({ h: 48 - i * 2, sg: fn(48 - i * 2) }));

test('fermentacao estabilizou: densidade parada 2 dias depois de cair', () => {
    const r = detectStable(serie(() => 1.012), 1.050);
    assert.deepEqual(r, { sg: 1.012 });
});

test('ainda caindo, pouco tempo de leitura ou sem fermentar: nao avisa', () => {
    assert.equal(detectStable(serie((h) => 1.012 + h * 0.0002), 1.050), null, 'caiu ~0,01 em 2 dias');
    assert.equal(detectStable(serie(() => 1.012).filter((x) => x.h <= 30), 1.050), null, 'menos de 2 dias');
    assert.equal(detectStable(serie(() => 1.048), 1.050), null, 'parada sem ter fermentado');
    assert.equal(detectStable(serie(() => 1.012), NaN), null, 'sem densidade inicial');
    assert.deepEqual(detectStable(serie(() => 1.012), 1050), { sg: 1.012 }, 'OG em pontos (1050)');
});

test('padrao exportado tem todos os campos booleanos dos tipos', () => {
    for (const k of ['tempBackEnabled', 'stepChangeEnabled', 'forecastEnabled', 'profileDoneEnabled', 'onlineEnabled', 'sensorLostEnabled']) {
        assert.equal(DEFAULT_ALERT_CONFIG[k], true, k);
    }
});
