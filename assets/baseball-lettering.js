// Local readability adjustments; the words themselves stay unchanged.
export function baseballInkOptions(text) {
    const advances = new Map(), steady = new Set(), xOffsets = new Map(), smoothBaseline = new Set();
    if (text.startsWith('.I just need.')) {
        for (let index = 1; index < '.I just need.'.length; index++) smoothBaseline.add(index);
    }
    if (text.startsWith('Naturally')) {
        for (let index = 0; index < 'Naturally I love nature.'.length; index++) smoothBaseline.add(index);
        for (let index = 0; index < 'Naturally'.length; index++) xOffsets.set(index, -18);
    }
    const phrases = ['trees and grass. Naturally my mind loves nature. I need to see outside.'];
    for (const phrase of phrases) {
        const start = text.indexOf(phrase);
        if (start < 0) continue;
        for (let i = start; i < start + phrase.length; i++) {
            if (text[i] === ' ') advances.set(i, 65);
        }
    }
    for (const match of text.matchAll(/outside/gi)) {
        for (let i = match.index; i < match.index + match[0].length; i++) steady.add(i);
    }
    return { advances, steady, xOffsets, smoothBaseline, roundPeriods: true };
}
