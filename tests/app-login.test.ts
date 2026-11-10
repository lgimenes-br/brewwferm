import { describe, it, expect } from 'vitest';
import { isAllowedAppRedirect } from '../components/AppLogin';

describe('isAllowedAppRedirect (mesma regra do backend)', () => {
    it('aceita o app e o Expo Go', () => {
        expect(isAllowedAppRedirect('breww://auth')).toBe(true);
        expect(isAllowedAppRedirect('exp://192.168.0.10:8081/--/auth')).toBe(true);
    });
    it('recusa outros destinos', () => {
        expect(isAllowedAppRedirect('https://evil.example/cb')).toBe(false);
        expect(isAllowedAppRedirect('javascript:alert(1)')).toBe(false);
    });
});
