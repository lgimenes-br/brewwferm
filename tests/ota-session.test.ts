import { describe, it, expect } from 'vitest';
import { createOtaSession, applyOtaMessage, applyOtaTelemetry, isOtaFinal } from '../services/otaSession';

const T0 = 1_000_000;

describe('otaSession', () => {
    it('fluxo completo com fases do firmware novo', () => {
        let s = createOtaSession('ABC', { targetVersion: '2.3.0' }, T0);
        expect(s.stage).toBe('sent');
        s = applyOtaMessage(s, { stage: 'received', progress: 0 }, T0 + 300);
        s = applyOtaMessage(s, { stage: 'connecting', progress: 0, attempt: 1 }, T0 + 500);
        s = applyOtaMessage(s, { stage: 'downloading', progress: 10 }, T0 + 3000);
        s = applyOtaMessage(s, { stage: 'downloading', progress: 55 }, T0 + 15000);
        expect(s.progress).toBe(55);
        s = applyOtaMessage(s, { stage: 'verifying', progress: 100 }, T0 + 30000);
        s = applyOtaMessage(s, { stage: 'rebooting', progress: 100 }, T0 + 31000);
        s = applyOtaTelemetry(s, '2.3.0', T0 + 40000);
        expect(s.stage).toBe('done');
        expect(isOtaFinal(s)).toBe(true);
        // um evento por fase (downloads repetidos nao poluem o log)
        expect(s.events.map(e => e.text)).toHaveLength(7);
        expect(s.events[1]).toMatchObject({ text: 'Aparelho recebeu o comando', ts: T0 + 300 });
    });

    it('tentativa extra e falha definitiva', () => {
        let s = createOtaSession('ABC', {}, T0);
        s = applyOtaMessage(s, { stage: 'retry', attempt: 2, error: 'connection lost' }, T0 + 1);
        expect(s.events.at(-1)?.text).toContain('connection lost');
        expect(s.events.at(-1)?.text).toContain('2 de 3');
        s = applyOtaMessage(s, { stage: 'failed', attempt: 3, error: 'timeout' }, T0 + 2);
        expect(s.stage).toBe('failed');
        // depois de final, nada muda
        expect(applyOtaMessage(s, { stage: 'downloading', progress: 50 }, T0 + 3)).toBe(s);
    });

    it('compatível com firmware antigo (so progress)', () => {
        let s = createOtaSession('ABC', {}, T0);
        s = applyOtaMessage(s, { progress: 20 }, T0 + 1);
        expect(s.stage).toBe('downloading');
        s = applyOtaMessage(s, { progress: 100 }, T0 + 2);
        expect(s.stage).toBe('rebooting');
    });

    it('versao diferente da esperada apos reiniciar = falha', () => {
        let s = createOtaSession('ABC', { targetVersion: '2.3.0' }, T0);
        s = applyOtaMessage(s, { stage: 'rebooting', progress: 100 }, T0 + 1);
        s = applyOtaTelemetry(s, '2.2.0', T0 + 2);
        expect(s.stage).toBe('failed');
    });
});
