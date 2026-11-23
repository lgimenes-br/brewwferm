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
