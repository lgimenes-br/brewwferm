import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideProfileSync, stepsMatch, toDeviceSteps, hasRemoteProfileSupport, createProfileLiveStore } from '../services/profileSync.js';

const NOW = Date.UTC(2026, 10, 11, 12, 0, 0);
const profile = [
    { name: 'Fermentação Lager', temperature: 20, duration: 7 },
    { name: 'Descanso de Diacetil', temperature: 16, duration: 3 },
    { name: 'Lagering', temperature: 1, duration: 10 },
];
const devSteps = toDeviceSteps(profile);
const startedAt = new Date(NOW - 30 * 3600000).toISOString(); // 30 h na etapa (banco)
const base = { opm: 0, isPaused: false, fermRun: 1 };

test('toDeviceSteps converte dias em horas', () => {
    assert.deepEqual(devSteps[0], { n: 'Fermentação Lager', t: 20, d: 168 });
    assert.equal(toDeviceSteps([{ n: 'X', t: 18, d: 36 }])[0].d, 36); // ja em horas
});

test('stepsMatch tolera arredondamento e pega diferencas', () => {
    assert.equal(stepsMatch([{ t: 20.0, d: 168.05 }, { t: 16, d: 72 }, { t: 1, d: 240 }], profile), true);
    assert.equal(stepsMatch([{ t: 16, d: 168 }, { t: 16, d: 72 }, { t: 1, d: 240 }], profile), false); // alvo diferente
    assert.equal(stepsMatch(devSteps.slice(0, 2), profile), false);
    assert.equal(stepsMatch(null, profile), false);
});

test('firmware antigo, outro modo ou sem perfil: nada a fazer', () => {
    assert.equal(hasRemoteProfileSupport({ opm: 0 }), false);
    assert.equal(decideProfileSync({ payload: { opm: 0 }, profile, dbStepIndex: 0, stepStartedAt: startedAt, now: NOW }), null);
    assert.equal(decideProfileSync({ payload: { ...base, opm: 1 }, profile, dbStepIndex: 0, now: NOW }), null);
    assert.equal(decideProfileSync({ payload: base, profile: [], dbStepIndex: 0, now: NOW }), null);
});

test('controlador sem perfil ativo recebe o do lote com o tempo do banco', () => {
    const d = decideProfileSync({ payload: { ...base, fermRun: 0 }, profile, dbStepIndex: 0, stepStartedAt: startedAt, now: NOW });
    assert.deepEqual(d, { currentStep: 0, stepTime: 30, reason: 'controlador sem perfil ativo' });
});

test('etapas diferentes: reenvia e preserva o tempo contado pelo controlador na mesma etapa', () => {
    const wrong = devSteps.map((s, i) => (i === 0 ? { ...s, t: 16 } : s));
    const d = decideProfileSync({ payload: { ...base, steps: wrong, currStep: 0, stepTime: 12.5 }, profile, dbStepIndex: 0, stepStartedAt: startedAt, now: NOW });
    assert.deepEqual(d, { currentStep: 0, stepTime: 12.5, reason: 'etapas diferentes do lote' });
    // perfil de fabrica em outra etapa: usa o tempo do banco
    const d2 = decideProfileSync({ payload: { ...base, steps: wrong, currStep: 2, stepTime: 99 }, profile, dbStepIndex: 0, stepStartedAt: startedAt, now: NOW });
    assert.equal(d2.stepTime, 30);
});

test('controlador atrasado e corrigido; adiantado e respeitado; alinhado nao faz nada', () => {
    const behind = decideProfileSync({ payload: { ...base, steps: devSteps, currStep: 0, stepTime: 5 }, profile, dbStepIndex: 1, stepStartedAt: startedAt, now: NOW });
    assert.equal(behind.currentStep, 1);
    assert.equal(decideProfileSync({ payload: { ...base, steps: devSteps, currStep: 2, stepTime: 1 }, profile, dbStepIndex: 1, stepStartedAt: startedAt, now: NOW }), null);
    assert.equal(decideProfileSync({ payload: { ...base, steps: devSteps, currStep: 1, stepTime: 3 }, profile, dbStepIndex: 1, stepStartedAt: startedAt, now: NOW }), null);
});

test('profileLive guarda pausa e expira em 15 min', () => {
    const store = createProfileLiveStore();
    store.update('abc123', { ...base, isPaused: true, currStep: 1 }, NOW);
    store.update('xyz', { opm: 0 }, NOW); // firmware antigo: ignorado
    assert.equal(store.get('ABC123', NOW).isPaused, true);
    assert.equal(store.get('XYZ', NOW), undefined);
    assert.equal(store.get('ABC123', NOW + 16 * 60000), undefined);
});
