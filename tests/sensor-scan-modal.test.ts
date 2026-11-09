import { describe, it, expect } from 'vitest';
import { initialRoles } from '../components/SensorScanModal';

describe('initialRoles', () => {
    const A = '28AAAAAAAAAAAAAA';
    const B = '28BBBBBBBBBBBBBB';
    const C = '28CCCCCCCCCCCCCC';

    it('sem mapeamento salvo segue a ordem do barramento', () => {
        expect(initialRoles([A, B, C])).toEqual({ [A]: 's1', [B]: 's2', [C]: 'none' });
    });
    it('respeita o mapeamento salvo na placa (case-insensitive)', () => {
        expect(initialRoles([A, B, C], C.toLowerCase(), A)).toEqual({ [A]: 's2', [B]: 'none', [C]: 's1' });
    });
    it('MAC salvo que sumiu do barramento não é substituído automaticamente', () => {
        // Controle configurado para um sensor ausente: não promover outro sensor sem o usuário decidir
        expect(initialRoles([A, B], C, '')).toEqual({ [A]: 's2', [B]: 'none' });
    });
    it('lista vazia', () => {
        expect(initialRoles([])).toEqual({});
    });
});

import { normalizePairCode } from '../components/Dashboard';

describe('normalizePairCode', () => {
    it('remove separadores de MAC', () => {
        expect(normalizePairCode(' 28:84:85:49:54:64 ')).toBe('288485495464');
        expect(normalizePairCode('4c-c4-ec-4c-ee-78')).toBe('4CC4EC4CEE78');
    });
    it('mantém outros formatos (apenas maiúsculas)', () => {
        expect(normalizePairCode('288485495464')).toBe('288485495464');
        expect(normalizePairCode('esp32_01')).toBe('ESP32_01');
    });
});
