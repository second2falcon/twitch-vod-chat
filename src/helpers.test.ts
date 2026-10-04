import { describe, it, expect } from 'vitest';
import { toFiniteNumber } from '@/helpers';

describe('toFiniteNumber', () => {

    it('coerces form input values', () => {
        expect(toFiniteNumber(300)).toBe(300);
        expect(toFiniteNumber(-300.5)).toBe(-300.5);
        expect(toFiniteNumber('300')).toBe(300);
        expect(toFiniteNumber('')).toBe(0);
        expect(toFiniteNumber('abc')).toBe(0);
        expect(toFiniteNumber(undefined)).toBe(0);
        expect(toFiniteNumber(NaN)).toBe(0);
        expect(toFiniteNumber(Infinity)).toBe(0);
    });

});
