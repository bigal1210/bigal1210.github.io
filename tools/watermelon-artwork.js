import { firstRambling } from '../assets/ramblings.js';
import { measureInkPassage, drawInkPassage } from '../assets/ink-lettering.js';

export function generateArtwork() {
    // Deterministic texture grain keeps the first prototype reproducible.
    let randomState = 716;
    function random() {
        randomState = (1664525 * randomState + 1013904223) >>> 0;
        return randomState / 4294967296;
    }
    function textureFromCanvas(draw, resolution = 1024) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = resolution;
        const context = canvas.getContext('2d');
        // Keep the artwork's coordinates fixed while rasterizing at full resolution.
        context.scale(canvas.width / 1024, canvas.height / 1024);
        draw(context, 1024);
        return canvas;
    }
    // Ink textures are drawn on the model, so the marks follow its rotation.
    function paper(ctx, size) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size, size);
    }
    function stroke(ctx, points, opacity, width = 1, color = '28,28,28') {
        ctx.strokeStyle = `rgba(${color},${opacity})`;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.stroke();
    }
    // Short tapered marks imitate the cuts and ink islands of a wood engraving.
    function gouge(ctx, x, y, angle, length, width, white = false) {
        const dx = Math.cos(angle), dy = Math.sin(angle);
        ctx.fillStyle = white ? '#fff' : '#252525';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + dx * length * .35 - dy * width, y + dy * length * .35 + dx * width, x + dx * length, y + dy * length);
        ctx.quadraticCurveTo(x + dx * length * .55 + dy * width * .4, y + dy * length * .55 - dx * width * .4, x, y);
        ctx.fill();
    }
    function stripeAt(x, y, size) {
        const u = x / size, v = y / size;
        return Math.sin(u * Math.PI * 20 + .48 * Math.sin(v * 18 + u * 25) + .2 * Math.sin(v * 51 + u * 90) + .09 * Math.sin(v * 157 + u * 183));
    }
    const rindTexture = textureFromCanvas((ctx, size) => {
        paper(ctx, size);
        // Broad black bands, with deliberately ragged edges rather than soft shading.
        const resolution = ctx.canvas.width;
        const scale = resolution / size;
        const pixels = ctx.createImageData(resolution, resolution);
        for (let py = 0; py < resolution; py++) {
            const y = (py + .5) / scale;
            for (let px = 0; px < resolution; px++) {
                const x = (px + .5) / scale;
                const wave = stripeAt(x, y, size);
                const edge = .06 * Math.sin(x * .35 + y * .19) + .05 * Math.sin(y * .71);
                const value = wave < -.05 + edge ? 36 : 255;
                const i = (py * resolution + px) * 4;
                pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
                pixels.data[i + 3] = 255;
            }
        }
        ctx.putImageData(pixels, 0, 0);
        for (let i = 0; i < 12500; i++) {
            const x = random() * size, y = random() * size;
            const wave = stripeAt(x, y, size);
            const white = wave < -.1;
            if (!white && wave > .65 && random() > .14) continue;
            gouge(ctx, x, y, 1.25 + Math.sin(y * .012) * .3 + (random() - .5) * .5,
                white ? 3 + random() * 16 : 3 + random() * 24,
                white ? 1 + random() * 2.6 : .8 + random() * 2.4, white);
        }
    }, 4096);
    const fleshTexture = textureFromCanvas((ctx, size) => {
        paper(ctx, size);
        const c = size / 2;
        // Uneven bundles of long tapered ink strokes follow the flesh fibers.
        for (let i = 0; i < 3600; i++) {
            const a = random() * Math.PI * 2;
            const r = Math.sqrt(random()) * c * .985;
            const band = r / c;
            const cluster = .5 + .5 * Math.sin(a * 11 + r * .025) * Math.sin(a * 7 - r * .016);
            const density = band > .48 && band < .91 ? .75 : .12;
            if (random() > density * cluster) continue;
            gouge(ctx, c + Math.cos(a) * r, c + Math.sin(a) * r,
                a + (random() - .5) * .2,
                Math.min(c * .96 - r, 7 + random() * (Math.sin(a * 11 + r * .014) > -.2 ? 66 : 22)),
                2.4 + random() * 5.2);
        }
        // The boundary is drawn in discontinuous, uneven strokes.
        for (let i = 0; i < 170; i++) {
            const a = random() * Math.PI * 2;
            const r = c * (.97 + random() * .022);
            const arc = .008 + random() * .045;
            const points = [];
            for (let j = 0; j <= 8; j++) {
                const t = a + j / 8 * arc;
                const rough = r + Math.sin(j * .4 + i) * .4;
                points.push([c + Math.cos(t) * rough, c + Math.sin(t) * rough]);
            }
            const width = 1.4 + random() * 2.4;
            if (i % 4 === 0) stroke(ctx, points, 1, width);
        }
    }, 4096);


    const passage = firstRambling.join('   ');
    const writingRadius = 1.685;
    const writingPlaneSize = 3.8;
    function drawWritingRing() {
        const nextTexture = textureFromCanvas((ctx, size) => {
            const r = writingRadius / writingPlaneSize * size;
            const availableArc = Math.PI * 2 - .15;
            const lineLength = availableArc * r;
            const penScale = lineLength / measureInkPassage(passage);
            // Draw every letter using original pressure-varying pen paths.
            const quality = 4;
            const strip = document.createElement('canvas');
            strip.width = Math.ceil(lineLength * quality);
            strip.height = Math.ceil(185 * penScale * quality);
            const ink = strip.getContext('2d');
            ink.scale(quality, quality);
            const baseline = 125 * penScale;
            drawInkPassage(ink, passage, 0, baseline, penScale);
            const start = -Math.PI / 2 + .075;
            for (let x = 0; x < strip.width; x += 2) {
                const slice = Math.min(2, strip.width - x);
                const angle = start + (x + slice / 2) / strip.width * availableArc;
                // Less than a pixel of pen drift keeps the baseline hand-drawn.
                const penDrift = .28 * Math.sin(angle * 13) + .15 * Math.sin(angle * 31);
                ctx.save();
                ctx.translate(size / 2 + Math.cos(angle) * (r + penDrift),
                    size / 2 + Math.sin(angle) * (r + penDrift));
                ctx.rotate(angle + Math.PI / 2);
                ctx.drawImage(strip, x, 0, slice, strip.height,
                    -slice / quality / 2, -baseline, slice / quality + .08, strip.height / quality);
                ctx.restore();
            }
        }, 4096);
        return nextTexture;
    }

    return { rind: rindTexture, flesh: fleshTexture, writing: drawWritingRing(), seedRandomState: randomState };
}
