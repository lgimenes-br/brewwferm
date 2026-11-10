import { describe, it, expect } from 'vitest';
import { registerCommand, evaluateCooldown, COOLDOWN_DEFAULT_MS, COOLDOWN_MAX_MS } from '../services/telemetryCooldown';

const T0 = 1_000_000;

describe('telemetryCooldown', () => {
    it('troca de modo: ignora telemetria velha e libera NA HORA quando o aparelho confirma', () => {
        const p = registerCommand(undefined, 'setMode', { value: 2 }, T0);
        // pacote velho (ainda geladeira = 1) chegando 200 ms depois: ignorado
        expect(evaluateCooldown(p, { opm: 1, csp: 4 }, T0 + 200)).toEqual({ inCooldown: true, confirmed: false });
        // pacote com o modo novo 600 ms depois: aceito
        expect(evaluateCooldown(p, { opm: 2, csp: 2 }, T0 + 600)).toEqual({ inCooldown: false, confirmed: true });
    });

    it('setpoint: confirma pelo valor (tolerancia de arredondamento)', () => {
        const p = registerCommand(undefined, 'setManual', { field: 'chopp_setpoint', val: 14.5 }, T0);
        expect(evaluateCooldown(p, { csp: 14.0 }, T0 + 100).inCooldown).toBe(true);
        expect(evaluateCooldown(p, { csp: 14.5000001 }, T0 + 300).confirmed).toBe(true);
    });

    it('modo + setpoint em sequencia: precisa dos dois', () => {
        let p = registerCommand(undefined, 'setMode', { value: 1 }, T0);
        p = registerCommand(p, 'setManual', { field: 'setpoint_manual', val: 3 }, T0 + 50);
        expect(evaluateCooldown(p, { opm: 1, csp: 5 }, T0 + 400).inCooldown).toBe(true);
        expect(evaluateCooldown(p, { opm: 1, csp: 3 }, T0 + 500).confirmed).toBe(true);
    });

    it('comando sem valor verificavel: janela curta', () => {
        const p = registerCommand(undefined, 'setChopp', { field: 'c_n1', val: 'IPA' }, T0);
        expect(evaluateCooldown(p, { opm: 2 }, T0 + COOLDOWN_DEFAULT_MS - 1).inCooldown).toBe(true);
        expect(evaluateCooldown(p, { opm: 2 }, T0 + COOLDOWN_DEFAULT_MS).inCooldown).toBe(false);
    });

    it('aparelho que nao confirma: libera no limite maximo', () => {
        const p = registerCommand(undefined, 'setMode', { value: 2 }, T0);
        expect(evaluateCooldown(p, { opm: 1 }, T0 + COOLDOWN_MAX_MS - 1).inCooldown).toBe(true);
        expect(evaluateCooldown(p, { opm: 1 }, T0 + COOLDOWN_MAX_MS).inCooldown).toBe(false);
    });
});
