import * as THREE from './vendor/three/three.module.js';
import { firstRambling } from './ramblings.js';
import { seedRandomState } from './textures/artwork-state.js';
import { inSpinBand, pointerOnFace, angleStep } from './watermelon-spin.js';

const mount = document.querySelector('#scene');
let renderer;
try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch (error) {
    document.querySelector('#fallback').hidden = false;
    document.querySelector('.hint').hidden = true;
    throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.25;
mount.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
camera.position.set(0, 0, 8.7);
scene.add(new THREE.HemisphereLight(0xffffff, 0x999999, 2.5));
const key = new THREE.DirectionalLight(0xffffff, 3.2);
key.position.set(-3, 5, 6);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, .65);
fill.position.set(4, -1, 2);
scene.add(fill);

// Deterministic texture grain keeps the first prototype reproducible.
let randomState = seedRandomState;
function random() {
    randomState = (1664525 * randomState + 1013904223) >>> 0;
    return randomState / 4294967296;
}
function textureFromCanvas(draw, resolution = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(resolution, renderer.capabilities.maxTextureSize);
    const context = canvas.getContext('2d');
    // Keep the artwork's coordinates fixed while rasterizing at full resolution.
    context.scale(canvas.width / 1024, canvas.height / 1024);
    draw(context, 1024);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
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
// Artwork is baked once with tools/bake-watermelon.py, not redrawn on visits.
const loader = new THREE.TextureLoader();
async function loadArtwork(name) {
    const texture = await loader.loadAsync(new URL(`./textures/${name}.png`, import.meta.url).href);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
}
const [rindTexture, fleshTexture, writingTexture] = await Promise.all(
    ['rind', 'flesh', 'writing'].map(loadArtwork));

const melon = new THREE.Group();
melon.scale.set(1.13, 1, .91);
scene.add(melon);
const radius = 1.9;
const shellGeometry = new THREE.SphereGeometry(radius, 128, 64, 0, Math.PI * 2, 0, Math.PI / 2);
shellGeometry.rotateX(-Math.PI / 2);
const shell = new THREE.Mesh(shellGeometry, new THREE.MeshBasicMaterial({ map: rindTexture }));
melon.add(shell);
function disc(innerRadius, outerRadius, color, z) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(innerRadius, outerRadius, 160), new THREE.MeshBasicMaterial({ color }));
    mesh.position.z = z;
    melon.add(mesh);
}
disc(1.82, radius, 0xffffff, .003);
disc(1.72, 1.875, 0xffffff, .005);
disc(1.68, 1.735, 0xffffff, .007);
const flesh = new THREE.Mesh(new THREE.CircleGeometry(1.69, 160), new THREE.MeshBasicMaterial({ map: fleshTexture }));
flesh.position.z = .012;
melon.add(flesh);

// Lettering lies on the exposed flesh and shares the watermelon's transform.
document.querySelector('#rambling-text').textContent = firstRambling.join('\n\n');
const writingPlaneSize = 3.8;
const writingMaterial = new THREE.MeshBasicMaterial({ map: writingTexture, transparent: true, depthWrite: false });
const writing = new THREE.Mesh(new THREE.PlaneGeometry(writingPlaneSize, writingPlaneSize), writingMaterial);
writing.position.z = .018;
melon.add(writing);

// The fruit stays round. Only the ink varies: thick pools, thin strokes,
// occasional breaks, and white cuts through the black edge.
function inkWidth(a) {
    return .014 + .013 * Math.pow(.5 + .5 * Math.sin(a * 5 + .8), 2)
        + .009 * Math.pow(.5 + .5 * Math.sin(a * 17 - .3), 5)
        + .004 * Math.sin(a * 61) * Math.sin(a * 29);
}
const edgeVertices = [];
const edgeIndices = [];
const breaks = [.44, 1.56, 2.83, 4.24, 5.52];
const segments = 1200;
for (let i = 0; i <= segments; i++) {
    const a = i / segments * Math.PI * 2;
    const gapDistance = Math.min(...breaks.map(b => Math.abs(a - b)));
    const taper = THREE.MathUtils.smoothstep(gapDistance, .009, .026);
    const outer = radius - .0015 * (1 + Math.sin(a * 43));
    const inner = outer - inkWidth(a) * taper;
    edgeVertices.push(Math.cos(a) * outer, Math.sin(a) * outer, .022,
        Math.cos(a) * inner, Math.sin(a) * inner, .022);
    if (i < segments) {
        const v = i * 2;
        edgeIndices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
}
const edgeGeometry = new THREE.BufferGeometry();
edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));
edgeGeometry.setIndex(edgeIndices);
melon.add(new THREE.Mesh(edgeGeometry, new THREE.MeshBasicMaterial({ color: 0x242424, side: THREE.DoubleSide })));
// Short white slivers and separate hairline strokes mimic worn printing ink.
for (let i = 0; i < 32; i++) {
    const start = i / 32 * Math.PI * 2 + .021 * Math.sin(i * 4.2);
    const arc = .016 + .035 * (.5 + .5 * Math.sin(i * 6.4));
    const points = [];
    for (let j = 0; j <= 16; j++) {
        const a = start + j / 16 * arc;
        const r = radius - inkWidth(a) * (.42 + .09 * Math.sin(j * .27));
        points.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, .023));
    }
    melon.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xffffff })));
    if (i % 3 === 0) {
        const finePoints = points.map(p => new THREE.Vector3(p.x * .982, p.y * .982, .024));
        melon.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(finePoints), new THREE.LineBasicMaterial({ color: 0x242424 })));
    }
}
const outline = new THREE.Mesh(shellGeometry, new THREE.MeshBasicMaterial({ color: 0x242424, side: THREE.BackSide }));
outline.scale.setScalar(1.001);
melon.add(outline);

// Each seed has its own rounded ink silhouette and carved white marks.
// A separate generator preserves the established positions and other textures.
const seedMaterial = new THREE.MeshBasicMaterial({ color: 0x242424 });
const cutMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
function createInkSeed(index) {
    let state = 9203 + index * 173;
    const variation = () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 4294967296;
    };
    const seed = new THREE.Group();
    const phase = variation() * Math.PI * 2;
    const lean = (variation() - .5) * .022;
    const controls = [];
    for (let j = 0; j < 16; j++) {
        const a = j / 16 * Math.PI * 2;
        const uneven = 1 + .06 * Math.sin(a * 3 + phase) + (variation() - .5) * .1;
        controls.push(new THREE.Vector3(
            .052 * Math.cos(a) * uneven * (1 - .14 * Math.sin(a)) + lean * Math.sin(a),
            .078 * Math.sin(a) * uneven, 0));
    }
    const curve = new THREE.CatmullRomCurve3(controls, true, 'centripetal');
    const silhouette = new THREE.Shape(curve.getPoints(96).map(p => new THREE.Vector2(p.x, p.y)));
    seed.add(new THREE.Mesh(new THREE.ExtrudeGeometry(silhouette, {
        depth: .006, bevelEnabled: false, steps: 1, curveSegments: 12
    }), seedMaterial));

    // Asymmetric wedges and crescents, instead of an identical shiny highlight.
    const offset = -.016 + variation() * .017;
    const top = .025 + variation() * .028;
    const bottom = -.018 - variation() * .029;
    const width = .006 + variation() * .009;
    const cut = new THREE.Shape();
    if (index % 3 === 0) {
        cut.moveTo(offset, top);
        cut.bezierCurveTo(offset - width * 1.4, top * .5, offset - width, bottom * .7, offset + .003, bottom);
        cut.lineTo(offset + width * .3, bottom * .35);
        cut.lineTo(offset + width, bottom * .6);
        cut.bezierCurveTo(offset - width * .3, .006, offset + width * .7, top * .7, offset, top);
    } else {
        cut.moveTo(offset, top);
        cut.bezierCurveTo(offset - width, top * .6, offset - width * .45, bottom * .45, offset + .002, bottom);
        cut.lineTo(offset + width * .55, bottom * .18);
        cut.lineTo(offset + width * .25, .006);
        cut.lineTo(offset + width * .85, .016);
        cut.quadraticCurveTo(offset + width * .7, top * .7, offset, top);
    }
    const carving = new THREE.Mesh(new THREE.ShapeGeometry(cut, 12), cutMaterial);
    carving.position.z = .007;
    seed.add(carving);
    // Small irregular pinholes and edge nicks vary from seed to seed.
    const fleckCount = index % 4;
    for (let j = 0; j < fleckCount; j++) {
        const x = .007 + variation() * .022;
        const y = -.045 + variation() * .074;
        const size = .0018 + variation() * .0025;
        const fleck = new THREE.Shape();
        fleck.moveTo(x, y);
        fleck.lineTo(x + size, y + size * .5);
        fleck.lineTo(x + size * .5, y + size * 2.1);
        fleck.lineTo(x - size * .7, y + size);
        fleck.closePath();
        const chip = new THREE.Mesh(new THREE.ShapeGeometry(fleck), cutMaterial);
        chip.position.z = .0075;
        seed.add(chip);
    }
    return seed;
}
for (let ring = 0; ring < 2; ring++) {
    const count = ring ? 19 : 9;
    for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2 + (ring ? .08 : .3) + (random() - .5) * .24;
        const distance = (ring ? 1.28 : .78) + (random() - .5) * .24;
        const seed = createInkSeed(ring * 19 + i);
        seed.position.set(Math.cos(angle) * distance, Math.sin(angle) * distance, .02);
        seed.rotation.z = angle - Math.PI / 2 + (random() - .5) * .5;
        seed.scale.set(.65 + random() * .6, .8 + random() * .65, 1);
        melon.add(seed);
    }
}

// Keep the original shadow footprint; only its ink strokes shift slightly.
const shadowMarks = [];
const shadowTexture = textureFromCanvas((ctx, size) => {
    for (let i = 0; i < 1000; i++) {
        const x = (random() + random()) * size / 2;
        const y = (random() + random() + random()) * size / 3;
        const falloff = Math.max(0, 1 - Math.hypot((x - size / 2) / (size / 2), (y - size / 2) / (size / 2)));
        if (random() > falloff * .8) continue;
        const length = 12 + random() * 80;
        const slope = -2 - random() * 6;
        const width = 2.2 + random() * 4;
        shadowMarks.push({ x, y, length, slope, width, phase: i * 2.399, falloff });
        stroke(ctx, [[x, y], [x + length, y + slope]], 1, width);
    }
});
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5, .6), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
shadow.position.set(.1, -2, -.8);
scene.add(shadow);
const shadowContext = shadowTexture.image.getContext('2d');
let previousInkRotation = new THREE.Vector3(.26, -.72, -.16);
let lastInkTime = 0, breezeTime = 0, rustleEnergy = 0;
function rustleShadowInk(time) {
    if (reducedMotion) return;
    const dt = lastInkTime ? Math.min((time - lastInkTime) / 1000, .05) : 1 / 60;
    lastInkTime = time;
    const movement = Math.abs(melon.rotation.x - previousInkRotation.x)
        + Math.abs(melon.rotation.y - previousInkRotation.y)
        + Math.abs(melon.rotation.z - previousInkRotation.z);
    previousInkRotation.set(melon.rotation.x, melon.rotation.y, melon.rotation.z);
    const gust = Math.min(1, movement / dt * .6);
    rustleEnergy += (gust - rustleEnergy) * (1 - Math.exp(-dt / (gust > rustleEnergy ? .18 : 1.3)));
    breezeTime += dt;
    const strength = .08 + rustleEnergy * .92;
    shadowContext.clearRect(0, 0, 1024, 1024);
    for (const mark of shadowMarks) {
        // Nearby marks share a drifting gust, with smaller independent flutter.
        // The envelope rises gently and settles after movement, never jittering.
        const local = mark.x * .012 + mark.y * .006;
        const wave = Math.sin(breezeTime * 1.7 - local)
            + .35 * Math.sin(breezeTime * 2.9 - local * .6 + 1.8);
        const flutter = Math.sin(breezeTime * (2.8 + .4 * Math.sin(mark.phase)) + mark.phase);
        const weight = strength * (.3 + mark.falloff * .7);
        const dx = (wave * 4 + flutter * 1.2) * weight;
        const dy = (wave * 9 + flutter * 3) * weight;
        const bend = Math.sin(breezeTime * 2.2 - local + mark.phase * .15) * 4 * weight;
        stroke(shadowContext, [[mark.x + dx, mark.y + dy],
            [mark.x + dx + mark.length * .5, mark.y + dy + mark.slope * .5 + bend],
            [mark.x + dx + mark.length, mark.y + dy + mark.slope - bend * .4]], 1, mark.width);
    }
    shadowTexture.needsUpdate = true;
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let progress = 0, targetProgress = 0, dragX = 0, dragY = 0, dragZ = 0;
let zoom = 1, targetZoom = 1;
let pointer = null;
const zoomRaycaster = new THREE.Raycaster();
const zoomPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const zoomWorldPoint = new THREE.Vector3();
let zoomAnchor = null;
function changeZoom(delta, clientX, clientY) {
    const nextZoom = THREE.MathUtils.clamp(targetZoom * Math.exp(-delta), .3, 2.4);
    if (nextZoom === targetZoom) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    const screen = new THREE.Vector2(
        (clientX - bounds.left) / bounds.width * 2 - 1,
        1 - (clientY - bounds.top) / bounds.height * 2);
    camera.updateMatrixWorld();
    melon.updateWorldMatrix(true, true);
    zoomRaycaster.setFromCamera(screen, camera);
    // Ignore transparent lettering planes and the back-face outline: anchor
    // to the actual fruit surface, including when viewing the back.
    const surfaces = melon.children.filter(child => child.isMesh && !child.material.transparent && child !== outline);
    const hit = zoomRaycaster.intersectObjects(surfaces, false)[0];
    if (hit) {
        zoomAnchor = { screen, point: melon.worldToLocal(hit.point.clone()), onMelon: true };
    } else {
        const point = zoomRaycaster.ray.intersectPlane(zoomPlane, new THREE.Vector3());
        zoomAnchor = point ? { screen, point, onMelon: false } : null;
    }
    targetZoom = nextZoom;
    targetProgress = reducedMotion ? 0 : -Math.log(targetZoom) * .65;
}
function keepZoomAnchor() {
    if (!zoomAnchor) return;
    zoomWorldPoint.copy(zoomAnchor.point);
    if (zoomAnchor.onMelon) melon.localToWorld(zoomWorldPoint);
    const halfHeight = (camera.position.z - zoomWorldPoint.z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Shift the camera sideways as it approaches, keeping the chosen point
    // beneath the cursor throughout both eased zoom and scroll rotation.
    camera.position.x = zoomWorldPoint.x - zoomAnchor.screen.x * halfHeight * camera.aspect;
    camera.position.y = zoomWorldPoint.y - zoomAnchor.screen.y * halfHeight;
}
renderer.domElement.addEventListener('wheel', event => {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? mount.clientHeight : 1;
    const delta = THREE.MathUtils.clamp(event.deltaY * unit, -150, 150);
    changeZoom(delta * (event.ctrlKey ? .004 : .0018), event.clientX, event.clientY);
}, { passive: false });
renderer.domElement.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointer) return;
    melon.updateWorldMatrix(true, false);
    const inverse = melon.matrixWorld.clone().invert();
    const face = pointerOnFace(camera, inverse, renderer.domElement.getBoundingClientRect(), event.clientX, event.clientY);
    zoomAnchor = null;
    pointer = {
        id: event.pointerId, x: event.clientX, y: event.clientY,
        mode: inSpinBand(face) ? 'spin' : 'turn', inverse,
        angle: face ? Math.atan2(face.y, face.x) : 0
    };
    renderer.domElement.style.cursor = 'grabbing';
    renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointermove', event => {
    if (!pointer) return;
    if (pointer.id !== event.pointerId) return;
    if (pointer.mode === 'spin') {
        // Use the face orientation at grab time, so its own rotation does not
        // feed back into the drag angle. Capture keeps the gesture continuous.
        const face = pointerOnFace(camera, pointer.inverse, renderer.domElement.getBoundingClientRect(), event.clientX, event.clientY);
        if (face && Math.hypot(face.x, face.y) > .2) {
            const angle = Math.atan2(face.y, face.x);
            dragZ += angleStep(pointer.angle, angle);
            pointer.angle = angle;
        }
    } else {
        dragX += (event.clientX - pointer.x) * .004;
        dragY += (event.clientY - pointer.y) * .003;
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    renderer.domElement.addEventListener(event, () => {
        pointer = null;
        renderer.domElement.style.cursor = 'grab';
    });
}
function resize() {
    zoomAnchor = null;
    const width = mount.clientWidth, height = mount.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
let firstFrame = true;
renderer.setAnimationLoop(time => {
    progress += (targetProgress - progress) * .065;
    melon.rotation.set(.26 + dragY, -.72 + progress * .52 + dragX, -.16 + progress * .3 + dragZ);
    zoom += (targetZoom - zoom) * (reducedMotion ? 1 : .09);
    camera.position.z = (camera.aspect < 1 ? 8.7 / camera.aspect : 8.7) * zoom;
    keepZoomAnchor();
    rustleShadowInk(time);
    renderer.render(scene, camera);
    if (firstFrame) {
        firstFrame = false;
        document.querySelector('#loading').hidden = true;
        mount.dataset.ready = 'true';
        performance.mark('watermelon-ready');
        const start = performance.getEntriesByName('watermelon-start')[0];
        if (start) mount.dataset.loadMs = Math.round(performance.now() - start.startTime);
    }
});
