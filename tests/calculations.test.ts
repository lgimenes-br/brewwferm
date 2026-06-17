import { describe, it, expect } from 'vitest';

export const calculateABV = (og: number, fg: number) => {
    if (og && fg && og > fg) {
        return ((og - fg) * 131.25);
    }
    return 0;
};

export const calculateAttenuation = (og: number, fg: number) => {
    if (og && fg && og > 1.000) {
        return ((og - fg) / (og - 1.000) * 100);
    }
    return 0;
};

describe('Brew Calculations', () => {
    it('should calculate ABV correctly', () => {
        expect(calculateABV(1.050, 1.010).toFixed(2)).toBe('5.25');
        expect(calculateABV(1.060, 1.015).toFixed(2)).toBe('5.91');
    });

    it('should return 0 ABV if OG is less than or equal to FG', () => {
        expect(calculateABV(1.010, 1.010)).toBe(0);
        expect(calculateABV(1.005, 1.010)).toBe(0);
    });

    it('should calculate attenuation correctly', () => {
        expect(calculateAttenuation(1.050, 1.010).toFixed(0)).toBe('80');
    });
});
