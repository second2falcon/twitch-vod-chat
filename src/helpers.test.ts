import { describe, it, expect } from 'vitest';
import { findFirstCommentAfter, toFiniteNumber } from '@/helpers';

const c = (t?: number) => ({ content_offset_seconds: t });

describe('findFirstCommentAfter', () => {

    it('handles empty and out of range times', () => {
        expect(findFirstCommentAfter([], 10)).toBe(0);
        const comments = [c(1), c(2), c(3)];
        expect(findFirstCommentAfter(comments, -5)).toBe(0);
        expect(findFirstCommentAfter(comments, 100)).toBe(3);
    });

    it('puts comments at exactly the time before the index', () => {
        const comments = [c(1), c(2), c(2), c(2), c(3)];
        expect(findFirstCommentAfter(comments, 2)).toBe(4);
        expect(findFirstCommentAfter(comments, 1.999)).toBe(1);
    });

    it('matches a linear scan', () => {
        const comments = [] as { content_offset_seconds?: number }[];
        let t = 0;
        for (let i = 0; i < 2000; i++) {
            t += Math.random() < 0.3 ? 0 : Math.random() * 3;
            comments.push(c(t));
        }
        for (let k = 0; k < 200; k++) {
            const time = Math.random() * (t + 10) - 5;
            const linear = comments.findIndex((x) => (x.content_offset_seconds as number) > time);
            expect(findFirstCommentAfter(comments, time)).toBe(linear === -1 ? comments.length : linear);
        }
    });

});

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
