// Original pen paths. Coordinates describe each pen movement, not font glyphs.
// Baseline is y=90; lower-case bodies start near y=35, with real descenders.
const letters = {
    a: [57, [[[45,44],[22,37],[10,54],[12,82],[29,85],[42,68],[46,43],[43,86],[54,83]]]],
    b: [56, [[[13,10],[12,48],[11,87]],[[13,57],[30,38],[46,45],[45,73],[27,87],[13,82]]]],
    c: [49, [[[43,44],[23,36],[9,52],[12,81],[31,86],[44,77]]]],
    d: [58, [[[44,43],[22,38],[10,57],[16,83],[34,85],[44,64],[48,34],[49,7],[46,87],[56,82]]]],
    e: [50, [[[9,61],[30,57],[42,47],[30,36],[12,47],[10,76],[25,87],[47,79]]]],
    f: [40, [[[13,119],[18,85],[22,50],[24,22],[33,9],[42,16]],[[7,47],[22,45],[37,46]]]],
    g: [57, [[[45,43],[25,36],[10,53],[15,80],[34,82],[44,62],[47,41],[44,98],[35,120],[14,116]]]],
    h: [57, [[[12,9],[11,50],[10,88]],[[12,60],[28,39],[43,42],[46,87]]]],
    i: [25, [[[12,41],[11,70],[13,87],[21,84]],[[14,18],[15,20]]]],
    j: [28, [[[19,41],[18,83],[16,112],[7,121],[-2,114]],[[21,18],[22,20]]]],
    k: [53, [[[12,9],[11,88]],[[47,39],[30,59],[13,69]],[[29,60],[39,76],[51,87]]]],
    l: [26, [[[13,9],[11,54],[12,83],[21,88]]]],
    m: [85, [[[10,88],[12,40],[13,56],[28,39],[40,44],[42,88]],[[43,55],[59,40],[73,44],[75,88]]]],
    n: [57, [[[10,88],[12,40],[13,57],[30,39],[44,44],[46,88]]]],
    o: [55, [[[25,36],[10,49],[12,80],[33,86],[46,70],[42,41],[25,36]]]],
    p: [57, [[[12,41],[11,82],[10,123]],[[13,55],[30,37],[46,47],[43,75],[26,85],[12,78]]]],
    q: [57, [[[44,44],[24,37],[10,54],[17,82],[36,81],[44,62],[47,41],[44,121]]]],
    r: [43, [[[11,88],[12,41],[13,59],[24,40],[36,40],[41,46]]]],
    s: [47, [[[42,43],[22,37],[11,52],[34,68],[38,81],[20,89],[9,81]]]],
    t: [39, [[[21,20],[17,58],[16,79],[23,88],[35,82]],[[6,45],[21,43],[37,44]]]],
    u: [57, [[[11,41],[12,82],[30,85],[43,66],[46,40],[45,87],[54,83]]]],
    v: [51, [[[8,40],[18,69],[27,88],[37,66],[47,39]]]],
    w: [78, [[[7,40],[15,68],[23,88],[37,49],[48,88],[60,67],[71,40]]]],
    x: [51, [[[9,41],[29,65],[46,88]],[[44,40],[29,61],[9,87]]]],
    y: [54, [[[9,40],[22,67],[30,83]],[[47,39],[33,78],[21,112],[10,122]]]],
    z: [49, [[[9,43],[26,40],[43,42],[28,64],[9,85],[28,88],[45,85]]]],
    I: [35, [[[7,14],[30,13]],[[20,14],[17,88]],[[5,89],[29,88]]]],
    T: [62, [[[5,15],[33,12],[60,14]],[[34,14],[30,90]]]],
    N: [66, [[[11,90],[12,14],[28,40],[53,87],[56,12]]]],
    S: [59, [[[51,23],[40,12],[22,14],[11,27],[16,42],[35,52],[49,65],[46,82],[29,91],[11,81]]]],
    D: [66, [[[12,88],[13,14]],[[13,14],[35,13],[53,28],[59,51],[53,75],[36,88],[12,88]]]],
    Y: [59, [[[7,14],[30,49],[53,12]],[[30,49],[27,89]]]],
    P: [57, [[[12,90],[13,14]],[[13,15],[37,12],[49,24],[45,44],[27,51],[13,48]]]],
    L: [53, [[[14,12],[12,88],[47,86]]]],
    H: [65, [[[12,13],[11,89]],[[54,12],[52,90]],[[12,51],[53,48]]]],
    ',': [23, [[[13,84],[14,91],[8,104]]]],
    '’': [23, [[[14,12],[13,22],[8,29]]]],
    '-': [35, [[[6,59],[29,57]]]],
    '.': [23, [[[11,86],[13,89]]]],
    '?': [49, [[[7,25],[18,13],[35,14],[43,26],[38,40],[24,51],[23,64]],[[23,85],[25,88]]]],
    ' ': [28, []]
};
function glyphFor(character) {
    const [base, ...accents] = Array.from(character.normalize('NFD'));
    const glyph = letters[base];
    if (!glyph) throw new Error(`No drawn letter for ${character}`);
    return { width: glyph[0], paths: glyph[1], accents };
}
// Stable random variation: every occurrence differs, but stays put on redraw.
function penRandom(index, salt) {
    const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453;
    return (value - Math.floor(value)) * 2 - 1;
}
function letterSize(index) {
    const random = salt => penRandom(index, salt);
    const overall = random(1) * .04;
    return { width: 1 + overall + random(2) * .03, height: 1 + overall + random(3) * .05 };
}
function widthFor(character, index) {
    if (character === ' ') return 35 * (1 + .4 * penRandom(index, 4));
    return glyphFor(character).width * letterSize(index).width + 7 + 2 * penRandom(index, 5);
}
export function measureInkPassage(text) {
    return Array.from(text).reduce((total, char, i) => total + widthFor(char, i), 0);
}
export function measureInkCharacter(character, index) {
    return widthFor(character, index);
}
// Mostly straight pen movements preserve the corners of quick handwriting.
function penPath(ctx, points, seed, pressure = 3.1) {
    if (points.length < 2) return;
    const samples = [];
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[Math.max(0, i - 1)], b = points[i];
        const c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
        for (let j = 0; j < 9; j++) {
            const t = j / 9, t2 = t * t, t3 = t2 * t;
            const sample = axis => {
                const curve = .5 * ((2 * b[axis]) + (-a[axis] + c[axis]) * t
                    + (2 * a[axis] - 5 * b[axis] + 4 * c[axis] - d[axis]) * t2
                    + (-a[axis] + 3 * b[axis] - 3 * c[axis] + d[axis]) * t3);
                const straight = b[axis] + (c[axis] - b[axis]) * t;
                return straight * .95 + curve * .05;
            };
            samples.push([sample(0), sample(1)]);
        }
    }
    samples.push(points[points.length - 1]);
    const left = [], right = [];
    samples.forEach((p, i) => {
        const before = samples[Math.max(0, i - 1)], after = samples[Math.min(samples.length - 1, i + 1)];
        const dx = after[0] - before[0], dy = after[1] - before[1];
        const length = Math.hypot(dx, dy) || 1;
        const taper = .65 + .35 * Math.sin(Math.PI * i / (samples.length - 1));
        const progress = i / (samples.length - 1);
        const dryInk = Math.sin(seed * 1.8) > .7 && progress > .42 && progress < .45 ? .12 : 1;
        const width = pressure * taper * dryInk * (1 + .3 * Math.sin(i * .29 + seed));
        // Each edge catches the paper differently: chipped and swollen ink,
        // rather than a smooth, symmetrical outline around the pen path.
        const leftWidth = width * (1 + .27 * Math.sin(i * 1.71 + seed) + .14 * Math.sin(i * 3.13 - seed));
        const rightWidth = width * (1 + .3 * Math.sin(i * 1.37 - seed * 2) + .15 * Math.cos(i * 2.79 + seed));
        const drift = .55 * Math.sin(i * .83 + seed * 3);
        left.push([p[0] - dy / length * (leftWidth + drift), p[1] + dx / length * (leftWidth + drift)]);
        right.push([p[0] + dy / length * (rightWidth - drift), p[1] - dx / length * (rightWidth - drift)]);
    });
    ctx.beginPath();
    [...left, ...right.reverse()].forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fill();
    // Remove ink inside the drawn stroke itself. Transparent cuts expose the
    // underlying illustration, without painting a white box over the letter.
    const distances = [0];
    for (let i = 1; i < samples.length; i++) {
        distances.push(distances[i - 1] + Math.hypot(
            samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]));
    }
    const totalLength = distances[distances.length - 1];
    if (totalLength < 30) return; // Keep dots and accents intact.
    const noise = n => {
        const value = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
        return value - Math.floor(value);
    };
    const at = fraction => {
        const index = Math.max(1, distances.findIndex(distance => distance >= totalLength * fraction));
        const p = samples[index], before = samples[index - 1];
        const length = Math.hypot(p[0] - before[0], p[1] - before[1]) || 1;
        return { x: p[0], y: p[1], tx: (p[0] - before[0]) / length, ty: (p[1] - before[1]) / length };
    };
    ctx.save();
    ctx.clip();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = '#000';
    ctx.lineCap = 'round';
    const gapCount = totalLength > 150 ? 2 : totalLength > 55 ? 1 : 0;
    for (let cut = 0; cut < gapCount; cut++) {
        const point = at((cut + .35 + noise(cut) * .35) / gapCount);
        const reach = pressure * 1.8;
        ctx.lineWidth = 3.2 + noise(cut + 3) * 2.2;
        ctx.beginPath();
        ctx.moveTo(point.x - point.ty * reach - point.tx, point.y + point.tx * reach - point.ty);
        ctx.lineTo(point.x + point.ty * reach + point.tx, point.y - point.tx * reach + point.ty);
        ctx.stroke();
    }
    // A narrow, irregular slit also breaks up the solid middle of the ink.
    const fleck = at(.2 + noise(8) * .6);
    const slitLength = 5 + noise(9) * 8;
    ctx.lineWidth = 1.1 + noise(10) * .9;
    ctx.beginPath();
    ctx.moveTo(fleck.x - fleck.tx * slitLength / 2, fleck.y - fleck.ty * slitLength / 2);
    ctx.quadraticCurveTo(fleck.x - fleck.ty, fleck.y + fleck.tx,
        fleck.x + fleck.tx * slitLength / 2, fleck.y + fleck.ty * slitLength / 2);
    ctx.stroke();
    // Small paper-grain chips nibble at alternating sides of the same stroke.
    const chipCount = Math.min(9, Math.floor(totalLength / 18));
    for (let chip = 0; chip < chipCount; chip++) {
        const p = at(.08 + noise(20 + chip) * .84);
        const side = chip % 2 ? 1 : -1;
        const offset = pressure * (.55 + noise(40 + chip) * .45) * side;
        ctx.beginPath();
        ctx.ellipse(p.x - p.ty * offset, p.y + p.tx * offset,
            .7 + noise(60 + chip) * 1.1, 1.3 + noise(80 + chip) * 1.8,
            Math.atan2(p.ty, p.tx), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}
export function drawInkPassage(ctx, text, x, baseline, scale, indexOffset = 0) {
    let cursor = x;
    Array.from(text).forEach((character, position) => {
        const index = position + indexOffset;
        const glyph = glyphFor(character);
        const size = letterSize(index);
        ctx.save();
        ctx.translate(cursor, baseline);
        ctx.scale(scale, scale);
        // Each letter leans and wanders independently around its baseline center.
        // Keep these choices stable while rotating or zooming the watermelon.
        const halfWidth = glyph.width * size.width / 2;
        ctx.translate(halfWidth + 1.5 * penRandom(index, 6), 9 * penRandom(index, 7));
        ctx.rotate(.095 * penRandom(index, 8));
        ctx.transform(size.width, 0, -.085 + .1 * penRandom(index, 9), size.height, -halfWidth, -90 * size.height);
        ctx.fillStyle = '#242424';
        glyph.paths.forEach((path, j) => penPath(ctx, path, index * 2.17 + j, 4.9 + .65 * Math.sin(index * .7)));
        const center = glyph.width / 2;
        for (const accent of glyph.accents) {
            if (accent === '\u0308') {
                penPath(ctx, [[center - 10, 19],[center - 9, 21]], index, 3.2);
                penPath(ctx, [[center + 9, 18],[center + 10, 20]], index + 1, 3.2);
            } else if (accent === '\u030c') {
                penPath(ctx, [[center - 10, 14],[center, 25],[center + 11, 12]], index, 2.7);
            }
        }
        ctx.restore();
        cursor += widthFor(character, index) * scale;
    });
}
