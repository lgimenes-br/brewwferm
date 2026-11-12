// O campo bruto extra_sensors ({hum: 61}) nao pode virar linha do grafico (React error #31 em producao)
import { describe, it, expect } from 'vitest';
import { prepareTemperatureData, extraSensorKeys } from '../components/TemperatureChart';

const row = (i: number, extra: unknown) => ({ recorded_at: new Date(Date.now() - (5 - i) * 60000).toISOString(), temp_ferm: 18 + i * 0.1, temp_amb: 5, target_temp: 18, extra_sensors: extra });

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
        expect(extraSensorKeys([{ beerTemp: 18, extra_sensors: { hum: 61 } }])).toEqual([]);
    });
});
