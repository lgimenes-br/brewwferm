import { describe, it, expect } from 'vitest';
import { wifiQuality, isWeakWifi } from '../components/WifiSignal';

describe('wifiQuality', () => {
    it('classifica o RSSI', () => {
        expect(wifiQuality(-12)).toBe('excelente');
        expect(wifiQuality(-65)).toBe('bom');
        expect(wifiQuality(-77)).toBe('fraco');
        expect(wifiQuality(-84)).toBe('muito fraco');
        expect(wifiQuality(0)).toBe('sem dados');
        expect(wifiQuality(undefined)).toBe('sem dados');
    });
    it('sinal fraco abaixo de -70 dBm', () => {
        expect(isWeakWifi(-70)).toBe(false);
        expect(isWeakWifi(-71)).toBe(true);
        expect(isWeakWifi(null)).toBe(false);
    });
});
