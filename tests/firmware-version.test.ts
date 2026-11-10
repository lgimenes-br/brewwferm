import { describe, it, expect } from 'vitest';
import { isFirmwareUpdateAvailable } from '../services/firmware';

describe('isFirmwareUpdateAvailable', () => {
    it('oferece so versoes mais novas', () => {
        expect(isFirmwareUpdateAvailable('2.1.0', '2.0.9')).toBe(true);
        expect(isFirmwareUpdateAvailable('2.1.0', '2.1.0')).toBe(false);
        expect(isFirmwareUpdateAvailable('2.0.0', '2.1.0')).toBe(false);
        expect(isFirmwareUpdateAvailable('10.0.0', '9.9.9')).toBe(true);
    });
    it('build local ("dev") ou formato antigo recebe a versao oficial', () => {
        expect(isFirmwareUpdateAvailable('2.1.0', 'dev')).toBe(true);
        expect(isFirmwareUpdateAvailable('2.1.0', 'V1.0.017 SAFE-BOOT STABLE')).toBe(true);
    });
    it('sem versao publicada valida ou placa sem versao: nada', () => {
        expect(isFirmwareUpdateAvailable('0.0.0x', '1.0.0')).toBe(false);
        expect(isFirmwareUpdateAvailable('2.1.0', undefined)).toBe(false);
        expect(isFirmwareUpdateAvailable(undefined, '1.0.0')).toBe(false);
    });
});
