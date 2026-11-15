import { describe, it, expect } from 'vitest';
import { initialRoles } from '../components/SensorScanModal';

describe('initialRoles (Sensor 1..4, igual ao firmware 2.11)', () => {
    const A = '28AAAAAAAAAAAAAA';
    const B = '28BBBBBBBBBBBBBB';
    const C = '28CCCCCCCCCCCCCC';
    const D = '28DDDDDDDDDDDDDD';
    const E = '28EEEEEEEEEEEEEE';

    it('sem mapeamento salvo segue a ordem do barramento, ate 4 sensores', () => {
        expect(initialRoles([A, B, C])).toEqual({ [A]: 's1', [B]: 's2', [C]: 's3' });
        expect(initialRoles([A, B, C, D, E])).toEqual({ [A]: 's1', [B]: 's2', [C]: 's3', [D]: 's4', [E]: 'none' });
    });
    it('respeita o mapeamento antigo (macCtrl/mac2), case-insensitive; sensor novo vai para o proximo numero livre', () => {
        expect(initialRoles([A, B, C], C.toLowerCase(), A)).toEqual({ [A]: 's2', [B]: 's3', [C]: 's1' });
    });
    it('respeita os 4 numeros salvos na placa (slots)', () => {
        expect(initialRoles([A, B, C, D], undefined, undefined, [D, '', A, B])).toEqual({ [A]: 's3', [B]: 's4', [C]: 's2', [D]: 's1' });
    });
    it('numero salvo cujo sensor sumiu fica vazio (nao promove outro sensor sem o usuario decidir)', () => {
        expect(initialRoles([A, B], C, '')).toEqual({ [A]: 's2', [B]: 's3' });
    });
    it('lista vazia', () => {
        expect(initialRoles([])).toEqual({});
    });
});

import { sensorView, otherSensors, DeviceMode } from '../types';

describe('sensorView: quem controla e os outros sensores', () => {
    const base: any = { id: 'X', name: 'X', mode: DeviceMode.FERMENTER, currentFridgeTemp: 16, currentDevice: { temperature: 19, rawPayload: {} } };
    it('firmware antigo: fermentador pelo Sensor 1, geladeira pelo Sensor 2', () => {
        expect(sensorView(base).control).toBe(0);
        expect(sensorView({ ...base, mode: DeviceMode.FRIDGE }).control).toBe(1);
    });
    it('firmware 2.11: usa o sensor que o aparelho informa e lista os outros com nome', () => {
        const f = { ...base, sensor3_name: 'Ambiente', currentDevice: { rawPayload: { t: [19.1, 16.2, 24.5, null], ctl: 2, ctlMap: [2, -1, -1] } } };
        const v = sensorView(f);
        expect(v.control).toBe(2);
        expect(v.temps[v.control]).toBe(24.5);
        expect(v.supportsControl).toBe(true);
        expect(otherSensors(v)).toEqual([{ slot: 0, name: 'Sensor 1', temp: 19.1 }, { slot: 1, name: 'Sensor 2', temp: 16.2 }]);
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
