import { describe, expect, it } from 'vitest';
import { sensorPresence, type Fermenter } from '../types';

const dev = (p: Partial<Fermenter> & { cd?: Partial<Fermenter['currentDevice']> } = {}) => ({
    readings: [],
    ...p,
    currentDevice: { gravity: 0, temperature: 18, battery: 0, angle: 0, rssi: -60, lastUpdate: '', ...(p.cd || {}) },
}) as unknown as Fermenter;

describe('sensores opcionais: so aparece o que existe', () => {
    it('sem sensor de umidade nem iSpindel: nao aparece', () => {
        expect(sensorPresence(dev())).toEqual({ humidity: false, gravity: false });
    });
    it('existe mas sem leitura agora: aparece (com "--")', () => {
        expect(sensorPresence(dev({ hasHumidity: true, hasIspindel: true }))).toEqual({ humidity: true, gravity: true });
    });
    it('leitura chegando agora conta mesmo antes do servidor marcar', () => {
        expect(sensorPresence(dev({ cd: { gravity: 1.012, extSens: { hum: 61 } } as never }))).toEqual({ humidity: true, gravity: true });
    });
    it('densidade medida a mao no grafico do lote conta como densidade', () => {
        const f = dev({ readings: [{ gravity: 1.020 }] as never });
        expect(sensorPresence(f).gravity).toBe(true);
    });
});

import { otherSensors, type SensorView } from '../types';

const view = (temps: (number | undefined)[], control = 0): SensorView => ({ temps, names: ['S1', 'S2', 'S3', 'S4'], control, supportsControl: true });

describe('sensores de temperatura: so o que controla e obrigatorio', () => {
    it('sensor 2 que nunca existiu nao aparece; com leitura aparece', () => {
        expect(otherSensors(view([18, undefined, undefined, undefined]), [true, false, false, false])).toEqual([]);
        expect(otherSensors(view([18, 4.2, undefined, undefined]), [true, false, false, false]).map(o => o.slot)).toEqual([1]);
    });
    it('sensor 2 que existe e esta sem leitura aparece (com "--")', () => {
        expect(otherSensors(view([18, undefined, undefined, undefined]), [true, true, false, false])).toEqual([{ slot: 1, name: 'S2', temp: undefined }]);
    });
    it('geladeira: Sensor 1 que nunca existiu nao aparece; que existe sem leitura aparece', () => {
        expect(otherSensors(view([undefined, undefined, undefined, undefined], 1), [false, false, false, false])).toEqual([]);
        expect(otherSensors(view([undefined, 4.2, undefined, undefined], 1), [true, true, false, false])).toEqual([{ slot: 0, name: 'S1', temp: undefined }]);
    });
});
