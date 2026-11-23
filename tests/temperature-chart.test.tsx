// O campo bruto extra_sensors ({hum: 61}) nao pode virar linha do grafico (React error #31 em producao)
import { describe, it, expect } from 'vitest';
import { prepareTemperatureData, extraSensorKeys } from '../components/chartData';

const row = (i: number, extra: unknown) => ({ recorded_at: new Date(Date.now() - (5 - i) * 60000).toISOString(), temp_s1: 18 + i * 0.1, temp_s2: 5, target_temp: 18, extra_sensors: extra });

describe('TemperatureChart: dados', () => {
    it('extra_sensors em objeto (umidade) nao vira linha', () => {
        const pts = prepareTemperatureData([row(0, { hum: 61 }), row(1, { hum: 62 })]);
        expect(pts).toHaveLength(2);
        expect(pts[0]).not.toHaveProperty('extra_sensors');
        expect(extraSensorKeys(pts)).toEqual([]);
    });
    it('extras no formato antigo (lista de sensores) viram linhas numericas', () => {
        const pts = prepareTemperatureData([row(0, JSON.stringify([{ n: 'Sala', t: '22.5' }]))]);
        expect(extraSensorKeys(pts)).toEqual(['extra_Sala']);
        expect(pts[0].extra_Sala).toBe(22.5);
    });
    it('mesmo um ponto ja preparado com o campo bruto nao gera a linha', () => {
        expect(extraSensorKeys([{ sensor1Temp: 18, extra_sensors: { hum: 61 } }])).toEqual([]);
    });
});

describe('sensores 3 e 4 no grafico', () => {
    it('extra_sensors no formato do servidor ({ s3, s4, hum, ctl }) vira as linhas extra_s3 / extra_s4', () => {
        const pts = prepareTemperatureData([
            { sensor1Temp: 18, timestamp: '2026-11-15T10:00:00Z', extra_sensors: { s3: 21.5, s4: '19.0', hum: 61, ctl: 0 } },
            { sensor1Temp: 18.1, timestamp: '2026-11-15T10:01:00Z', extra_sensors: '{"s3":21.6,"hum":60}' },
        ] as any);
        expect(pts[0].extra_s3).toBe(21.5);
        expect(pts[0].extra_s4).toBe(19);
        expect(pts[1].extra_s3).toBe(21.6);
        expect(extraSensorKeys(pts).sort()).toEqual(['extra_s3', 'extra_s4']);
    });
});

describe('sensores numerados no grafico', () => {
    it('leitura so com o Sensor 2 (geladeira sem Sensor 1) continua no grafico', () => {
        const out = prepareTemperatureData([
            { recorded_at: '2026-11-23T10:00:00Z', temp_s1: null, temp_s2: 4.2, target_temp: 4 },
            { recorded_at: '2026-11-23T10:01:00Z', temp_s1: null, temp_s2: null, target_temp: 4 },
        ] as any, Infinity);
        expect(out).toHaveLength(1);
        expect(out[0].sensor2Temp).toBe(4.2);
        expect(Number.isNaN(out[0].sensor1Temp)).toBe(true);
    });
});
