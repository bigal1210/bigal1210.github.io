import * as THREE from './vendor/three/three.module.js';
import { baseballRambling } from './ramblings.js?v=baseball-writing-1';
import { measureInkPassage } from './ink-lettering.js?v=smooth-both-openings-1';

import { baseballInkOptions } from './baseball-lettering.js?v=smooth-both-openings-1';

// Pen marks are real geometry on the sphere, so they stay crisp when rotated.
export function createBaseball(writingTexture, marksTexture) {
    const object = new THREE.Group();
    const radius = 1.08;
    let state = 18471;
    const random = () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 4294967296;
    };
    const paper = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec3 leatherNormal;
            varying vec3 leatherPoint;
            void main() {
                leatherNormal = normalize(normalMatrix * normal);
                leatherPoint = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: `
            varying vec3 leatherNormal;
            varying vec3 leatherPoint;
            void main() {
                vec3 n = normalize(leatherNormal);
                float light = dot(n, normalize(vec3(-0.5, 0.7, 0.8)));
                float shade = 1.0 - smoothstep(-0.7, 0.85, light);
                vec3 cells = floor(leatherPoint * 330.0);
                float grain = fract(sin(dot(cells, vec3(127.1, 311.7, 74.7))) * 43758.5453);
                float tone = 1.0 - 0.2 * pow(shade, 1.5)
                    - 0.035 * pow(1.0 - abs(n.z), 2.0)
                    - 0.035 * step(0.78, grain) * (0.25 + shade);
                gl_FragColor = vec4(vec3(tone), 1.0);
                #include <colorspace_fragment>
            }`
    });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), paper);
    object.add(shell);
    const outlineGeometry = new THREE.SphereGeometry(radius, 96, 64);
    const vertices = outlineGeometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
        const pressure = 1.011 + .0025 * Math.sin(x * 19 + y * 13) * Math.sin(z * 23 - y * 7);
        vertices.setXYZ(i, x * pressure, y * pressure, z * pressure);
    }
    object.add(new THREE.Mesh(outlineGeometry,
        new THREE.MeshBasicMaterial({ color: 0x242424, side: THREE.BackSide })));

    // The complete rambling replaces the stitched seam, following its same
    // continuous 3D path. Arc-length sampling keeps the handwriting evenly sized.
    function seam(t) {
        const point = new THREE.Vector3(.75 * Math.cos(t) + .25 * Math.cos(3 * t),
            .75 * Math.sin(t) - .25 * Math.sin(3 * t),
            Math.sqrt(.75) * Math.sin(2 * t));
        // Bring both bands toward the equator in the initial front-facing pose,
        // then project back onto the leather without changing the ball's shape.
        const axis = new THREE.Vector3(0, 0, 1);
        point.applyAxisAngle(axis, Math.PI / 4);
        point.y *= .8;
        return point.normalize().multiplyScalar(radius).applyAxisAngle(axis, -Math.PI / 4);
    }
    class SeamCurve extends THREE.Curve {
        getPoint(t, target = new THREE.Vector3()) {
            return target.copy(seam(1.22 - t * Math.PI * 2));
        }
    }
    const curve = new SeamCurve();
    curve.arcLengthDivisions = 4096;
    const seamLength = curve.getLength();
    const rows = 8, rowWidth = 4080, rowHeight = 512, atlasSize = 4096;
    // Two neighboring tracks form one broad seam band. Each paragraph gets
    // a full trip around the ball, allowing larger letters with natural proportions.
    const rowsPerPassage = rows / baseballRambling.length;
    const unitsPerPixel = seamLength / (rowsPerPassage * rowWidth);
    const stripWidth = rowsPerPassage * rowWidth;
    const textLayouts = baseballRambling.map((text, passageIndex) => {
        const inkOptions = baseballInkOptions(text);
        const penScale = (stripWidth - 48) / measureInkPassage(text + '       ', inkOptions);
        return { penScale, start: 24 / stripWidth,
            end: (24 + measureInkPassage(text, inkOptions) * penScale) / stripWidth,
            pathStart: passageIndex === 0 ? .0045 : .0065,
            pathEnd: .987 };
    });
    // Both rows follow the same closed, gently snaking baseline. A periodic
    // bend gives the ending and opening words matching positions and slopes,
    // so neither row changes direction abruptly at the reading junction.
    function readingPoint(passageIndex, atlasDistance) {
        const layout = textLayouts[passageIndex];
        const amount = (atlasDistance - layout.start) / (layout.end - layout.start);
        const distance = THREE.MathUtils.lerp(layout.pathStart, layout.pathEnd, amount);
        const wrapped = ((distance % 1) + 1) % 1;
        const phase = wrapped * Math.PI * 2;
        let bend = -.28 * Math.sin(phase)
            * Math.exp(-Math.pow(Math.sin(phase / 2) / .15, 2));
        // Let both opening sentences follow the underlying seam instead of the
        // tight dip used at the paragraph junction. Ease back into the existing path.
        bend *= THREE.MathUtils.smoothstep(wrapped, 0, .13);
        const joinSpace = .012 * Math.exp(-Math.pow(Math.sin(phase / 2) / .12, 2));
        const offset = (passageIndex === 0 ? .025 + joinSpace : -.085 - joinSpace) + bend;
        const point = curve.getPointAt(wrapped);
        const tangent = curve.getTangentAt(wrapped);
        const sideways = point.clone().normalize().cross(tangent).normalize();
        return point.addScaledVector(sideways, offset).normalize().multiplyScalar(radius);
    }
    const positions = [], uvs = [], indices = [];
    const across = 16;
    for (let row = 0; row < rows; row++) {
        const passageIndex = Math.floor(row / rowsPerPassage);
        const passageRow = row % rowsPerPassage;
        const penScale = textLayouts[passageIndex].penScale;
        const baseline = 125 * penScale;
        const start = positions.length / 3;
        for (let step = 0; step <= 256; step++) {
            const u = step / 256;
            const distance = (passageRow + u) / rowsPerPassage;
            const point = readingPoint(passageIndex, distance);
            const tangent = readingPoint(passageIndex, distance + .00001)
                .sub(readingPoint(passageIndex, distance - .00001)).normalize();
            const sideways = point.clone().normalize().cross(tangent).normalize();
            for (let v = 0; v <= across; v++) {
                const vertical = v / across;
                const p = point.clone().addScaledVector(sideways,
                    (baseline - vertical * rowHeight - 40 * penScale) * unitsPerPixel * 1.15)
                    .normalize().multiplyScalar(radius * 1.004);
                positions.push(p.x, p.y, p.z);
                uvs.push((8 + u * rowWidth) / atlasSize,
                    1 - (row + vertical) * rowHeight / atlasSize);
            }
            if (step < 256) {
                for (let v = 0; v < across; v++) {
                    const k = start + step * (across + 1) + v;
                    indices.push(k, k + 1, k + across + 1,
                        k + 1, k + across + 2, k + across + 1);
                }
            }
        }
    }
    const writingGeometry = new THREE.BufferGeometry();
    writingGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    writingGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    writingGeometry.setIndex(indices);
    object.add(new THREE.Mesh(writingGeometry, new THREE.MeshBasicMaterial({
        map: writingTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide
    })));
    // Five small ink dots lead from the end of the upper paragraph into
    // Naturally on the lower row, following a short descending curve.
    const upperEnd = readingPoint(0, textLayouts[0].end);
    const lowerStart = readingPoint(1, textLayouts[1].start);
    const upperTangent = readingPoint(0, textLayouts[0].end + .00001)
        .sub(readingPoint(0, textLayouts[0].end - .00001)).normalize();
    const lowerTangent = readingPoint(1, textLayouts[1].start + .00001)
        .sub(readingPoint(1, textLayouts[1].start - .00001)).normalize();
    const upperSide = upperEnd.clone().normalize().cross(upperTangent).normalize();
    const lowerSide = lowerStart.clone().normalize().cross(lowerTangent).normalize();
    upperEnd.addScaledVector(upperSide, -.043).addScaledVector(upperTangent, -.017);
    lowerStart.addScaledVector(lowerSide, -.03).addScaledVector(lowerTangent, -.012);
    // Follow the reference: leave Beans gently, descend through the gap,
    // then ease into Naturally along its reading direction.
    const gapLength = upperEnd.distanceTo(lowerStart);
    const continuation = new THREE.CubicBezierCurve3(upperEnd,
        upperEnd.clone().addScaledVector(upperTangent, gapLength * .5),
        lowerStart.clone().addScaledVector(lowerTangent, -gapLength * .5), lowerStart);
    const dotPositions = [], dotIndices = [];
    for (let dot = 0; dot < 5; dot++) {
        const t = [0, .25, .5, .75, 1][dot];
        const center = continuation.getPoint(t);
        if (dot === 0) center.addScaledVector(upperTangent, .018);
        if (dot === 1) center.addScaledVector(upperSide, .005);
        if (dot === 2) center.addScaledVector(lowerSide, -.005);
        if (dot === 4) center.addScaledVector(lowerTangent, -.035);
        center.normalize().multiplyScalar(radius * 1.006);
        const normal = center.clone().normalize();
        const right = continuation.getTangent(t).projectOnPlane(normal).normalize();
        const up = normal.clone().cross(right).normalize();
        const start = dotPositions.length / 3;
        dotPositions.push(center.x, center.y, center.z);
        const size = [.0063, .006, .0064, .0061, .0063][dot];
        for (let i = 0; i < 20; i++) {
            const angle = i / 20 * Math.PI * 2;
            const grain = 1 + .12 * Math.sin(angle * 3 + dot) + .06 * Math.sin(angle * 7);
            const p = center.clone().addScaledVector(right, Math.cos(angle) * size * grain)
                .addScaledVector(up, Math.sin(angle) * size * grain * .88)
                .normalize().multiplyScalar(radius * 1.006);
            dotPositions.push(p.x, p.y, p.z);
            dotIndices.push(start, start + 1 + i, start + 1 + (i + 1) % 20);
        }
    }
    const dotGeometry = new THREE.BufferGeometry();
    dotGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dotPositions, 3));
    dotGeometry.setIndex(dotIndices);
    object.add(new THREE.Mesh(dotGeometry, new THREE.MeshBasicMaterial({
        color: 0x242424, side: THREE.DoubleSide
    })));
    // Leave a small unhatched channel for the actual letters, without a frame.
    const seamPoints = curve.getSpacedPoints(512);
    const letteringClearance = .155;

    // Curved, tapered pen strokes wrap around the leather. Their density follows
    // a fixed upper-left light, so turning the ball does not turn its shadow side.
    const hatchPositions = [], hatchNormals = [], hatchChances = [], hatchIndices = [];
    for (let i = 0; i < 14000; i++) {
        const y = random() * 2 - 1, angle = random() * Math.PI * 2;
        const n = new THREE.Vector3(Math.sqrt(1 - y * y) * Math.cos(angle), y,
            Math.sqrt(1 - y * y) * Math.sin(angle));
        const surfacePoint = n.clone().multiplyScalar(radius);
        if (seamPoints.some(point => point.distanceToSquared(surfacePoint) < letteringClearance ** 2)) continue;
        const crossHatch = i % 4 === 0;
        const axis = crossHatch ? new THREE.Vector3(.35, 1, .25) : new THREE.Vector3(1, .25, .15);
        const direction = axis.projectOnPlane(n).normalize();
        const sideways = n.clone().cross(direction).normalize();
        const length = .009 + random() * .038;
        const width = .001 + random() * .0016;
        const chance = crossHatch ? .38 + random() * .62 : random();
        const bend = (random() - .5) * .005;
        const start = hatchPositions.length / 3;
        for (let j = 0; j <= 5; j++) {
            const u = j / 5;
            const point = n.clone().multiplyScalar(radius)
                .addScaledVector(direction, (u - .5) * length)
                .addScaledVector(sideways, Math.sin(u * Math.PI) * bend).normalize();
            const pressure = width * (.15 + .85 * Math.sin(u * Math.PI))
                * (.85 + .15 * Math.sin(i + j * 2.3));
            for (const sign of [-1, 1]) {
                const edge = point.clone().multiplyScalar(radius)
                    .addScaledVector(sideways, sign * pressure / 2).normalize();
                hatchNormals.push(edge.x, edge.y, edge.z);
                edge.multiplyScalar(radius * 1.001);
                hatchPositions.push(edge.x, edge.y, edge.z);
                hatchChances.push(chance);
            }
            if (j < 5) {
                const k = start + j * 2;
                hatchIndices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
            }
        }
    }
    const hatchGeometry = new THREE.BufferGeometry();
    hatchGeometry.setAttribute('position', new THREE.Float32BufferAttribute(hatchPositions, 3));
    hatchGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(hatchNormals, 3));
    hatchGeometry.setAttribute('chance', new THREE.Float32BufferAttribute(hatchChances, 1));
    hatchGeometry.setIndex(hatchIndices);
    const hatchMaterial = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        vertexShader: `
            attribute float chance;
            varying float inkChance;
            varying vec3 surfaceNormal;
            void main() {
                inkChance = chance;
                surfaceNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: `
            varying float inkChance;
            varying vec3 surfaceNormal;
            void main() {
                vec3 n = normalize(surfaceNormal);
                vec3 light = normalize(vec3(-0.65, 0.8, 0.6));
                float shade = 1.0 - smoothstep(-0.55, 0.8, dot(n, light));
                float edge = pow(1.0 - abs(n.z), 2.5);
                float density = 0.025 + 0.62 * pow(shade, 1.7) + 0.1 * edge;
                if (inkChance > density) discard;
                gl_FragColor = vec4(vec3(0.018), 1.0);
                #include <colorspace_fragment>
            }`
    });
    object.add(new THREE.Mesh(hatchGeometry, hatchMaterial));
    // Initial pose matches the reference: a slight forward tilt with the print facing us.
    object.rotation.set(.20, .025, Math.PI / 4 + .01);
    const markPositions = [], markUvs = [], markIndices = [];
    const grid = 96;
    for (let y = 0; y <= grid; y++) {
        for (let x = 0; x <= grid; x++) {
            const px = (x / grid * 2 - 1) * radius;
            const py = (1 - y / grid * 2) * radius;
            const pz = Math.sqrt(Math.max(0, radius * radius - px * px - py * py));
            const p = new THREE.Vector3(px, py, pz).multiplyScalar(1.006)
                .applyAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 4);
            markPositions.push(p.x, p.y, p.z);
            markUvs.push(x / grid, 1 - y / grid);
            if (x < grid && y < grid) {
                const corners = [[x,y],[x+1,y],[x,y+1],[x+1,y+1]];
                if (corners.every(([cx,cy]) => (cx / grid * 2 - 1) ** 2
                    + (cy / grid * 2 - 1) ** 2 < .99 ** 2)) {
                    const k = y * (grid + 1) + x;
                    markIndices.push(k, k + grid + 1, k + 1, k + 1, k + grid + 1, k + grid + 2);
                }
            }
        }
    }
    const marksGeometry = new THREE.BufferGeometry();
    marksGeometry.setAttribute('position', new THREE.Float32BufferAttribute(markPositions, 3));
    marksGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(markUvs, 2));
    marksGeometry.setIndex(markIndices);
    object.add(new THREE.Mesh(marksGeometry, new THREE.MeshBasicMaterial({
        map: marksTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide
    })));

    const canvas = document.createElement('canvas');
    canvas.width = 768; canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#383838';
    for (let i = 0; i < 260; i++) {
        const x = (random() + random()) / 2 * 768;
        const y = (random() + random() + random()) / 3 * 160;
        const edge = Math.hypot((x - 384) / 384, (y - 80) / 80);
        if (edge > .95 || random() > 1 - edge * .8) continue;
        ctx.lineWidth = .6 + random() * 1.1;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + 8 + random() * 52, y - random() * 2); ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.85, .32),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    return { object, shell, shadow, radius };
}
