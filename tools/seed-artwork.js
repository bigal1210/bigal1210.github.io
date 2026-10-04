import { flowRambling } from '../assets/ramblings.js?v=seed-spiral-1';
import { drawInkPassage, measureInkCharacter } from '../assets/ink-lettering.js?v=seed-spiral-1';

// Reading-sized phrases retain the author's exact words and punctuation.
// Each phrase reads left to right; the next begins below it, never backwards.
const phrases = [
    'Success in life is like',
    'flirting with a girl or going on a date.',
    'There is ebb and flow',
    'and no specific end goal in mind,',
    'or at least, no attachment',
    'about how you’ll get there.',
    'You just jive and flow, say what you want,',
    'go where you want, tease if you want.',
    'If you’re confident enough, spontaneous enough,',
    'are happy by yourself,',
    'and just overall do what you want,',
    'you’ll mostly succeed no matter the circumstance',
    'and without a plan.',
    'Stuck up people have plans,',
    'attractive people go with the flow,',
    'are present, and intelligent.',
    'If you have that, success is inevitable,',
    'even if you have no idea how.',
    'The key about going on good dates is,',
    'like I said, being present, and knowing',
    'when to step into the next door.',
    'The world is your oyst-er.',
    'Play with it.',
    'Lead, but follow the world.',
    'How to go with the flow',
    'and have it work out every time.'
];
const normalize = text => text.replace(/\s+/g, ' ').trim();
if (normalize(phrases.join(' ')) !== normalize(flowRambling.join(' '))) {
    throw new Error('The phrase layout must preserve the complete rambling.');
}

// Baked separately: editing the lettering never redraws the fruit or other seeds.
export function generateSeedArtwork() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 3072;
    const ctx = canvas.getContext('2d');
    let characterIndex = 0;
    const lines = phrases.map((text, index) => {
        const chars = Array.from(text);
        const startIndex = characterIndex;
        const widths = chars.map((char, i) => measureInkCharacter(char, startIndex + i));
        characterIndex += chars.length + 1;
        const y = -820 + index / (phrases.length - 1) * 1680;
        const center = 100 * Math.sin(index * .29 - .7) * Math.sin(Math.PI * index / (phrases.length - 1));
        const available = 2 * (740 * Math.sqrt(1 - (y / 1160) ** 2) - Math.abs(center) - 35);
        return { chars, startIndex, widths, y, center, available,
            width: widths.reduce((a, b) => a + b, 0) };
    });
    // One consistent letter size; spacing comes from complete phrases, not
    // independent word rotations or collision-driven changes to reading order.
    const scale = Math.min(.54, ...lines.map(line => line.available / line.width));
    for (const [lineIndex, line] of lines.entries()) {
        const width = line.width * scale;
        const tilt = .08 * Math.sin(lineIndex * .20 + .5);
        const bow = 34 * Math.sin(lineIndex * .25 - .4);
        let cursor = -width / 2;
        for (let i = 0; i < line.chars.length; i++) {
            const advance = line.widths[i] * scale;
            const x = cursor + advance / 2;
            const t = x / width + .5;
            // A whole phrase shares a single broad, shallow curve. Adjacent
            // phrases change angle gradually, like handwriting on the page.
            const y = line.y + x * tilt + bow * Math.sin(t * Math.PI);
            const slope = tilt + bow * Math.PI / width * Math.cos(t * Math.PI);
            ctx.save();
            ctx.translate(1024 + line.center + x, 1536 + y);
            ctx.rotate(Math.atan(slope));
            drawInkPassage(ctx, line.chars[i], -advance / 2, 30 * scale, scale, line.startIndex + i);
            ctx.restore();
            cursor += advance;
        }
    }
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#f8f6f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return { canvas, characters: Array.from(phrases.join(' ')).length, scale, phrases: phrases.length };
}
