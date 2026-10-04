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

/**
 * Sort key for a comment, malformed offsets sort first so they're still reached (and counted) by the tick loop
 */
function commentSortKey(comment: { content_offset_seconds?: number }): number {
    const t = comment.content_offset_seconds;
    return typeof t === "number" && Number.isFinite(t) ? t : -Infinity;
}

/**
 * Make sure comments are in ascending content_offset_seconds order, live chat dumps are written in arrival order.
 * Stable, so comments with equal offsets keep their original order. Sorts in place.
 * @returns true if the array had to be sorted
 */
export function sortCommentsByOffset(comments: { content_offset_seconds?: number }[]): boolean {
    let sorted = true;
    for (let i = 1; i < comments.length; i++) {
        if (commentSortKey(comments[i]) < commentSortKey(comments[i - 1])) {
            sorted = false;
            break;
        }
    }
    if (sorted) return false;
    comments.sort((a, b) => commentSortKey(a) - commentSortKey(b));
    return true;
}

/**
 * Binary search for the index of the first comment with content_offset_seconds > time.
 * Everything before the returned index is at or before `time`. Comments must be sorted (see sortCommentsByOffset).
 */
export function findFirstCommentAfter(comments: { content_offset_seconds?: number }[], time: number): number {
    let lo = 0;
    let hi = comments.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (commentSortKey(comments[mid]) <= time) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    return lo;
}