export function fixupUrl(url: string) {
    if (url.startsWith("//")) return `https:${url}`;
    return url;
}

/**
 * Coerce a user-entered value (number, numeric string, "" or garbage) to a finite number, 0 if it isn't one.
 * Form inputs bound with v-model can hand us strings, and `number + string` is string concatenation.
 */
export function toFiniteNumber(value: unknown): number {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
}