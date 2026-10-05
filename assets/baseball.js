import * as THREE from './vendor/three/three.module.js';

// Pen marks are real geometry on the sphere, so they stay crisp when rotated.
export function createBaseball() {
    const object = new THREE.Group();
    const radius = 1.08;
    let state = 18471;
    const random = () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 4294967296;
    };
    const ink = new THREE.MeshBasicMaterial({ color: 0x242424, side: THREE.DoubleSide });
    const paper = new THREE.MeshBasicMaterial({ color: 0xffffff });
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

    const ribbonPositions = [], ribbonIndices = [];
    function pen(points, width, phase = 0) {
        const start = ribbonPositions.length / 3;
        points.forEach((p, i) => {
            const tangent = points[Math.min(points.length - 1, i + 1)].clone()
                .sub(points[Math.max(0, i - 1)]).normalize();
            const sideways = p.clone().normalize().cross(tangent).normalize();
            const pressure = width * (.85 + .16 * Math.sin(i * 1.8 + phase)
                + .1 * Math.sin(i * 4.1 - phase));
            for (const sign of [-1, 1]) {
                const edge = p.clone().addScaledVector(sideways, pressure * sign / 2)
                    .normalize().multiplyScalar(radius * 1.009);
                ribbonPositions.push(edge.x, edge.y, edge.z);
            }
            if (i < points.length - 1) {
                const j = start + i * 2;
                ribbonIndices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
            }
        });
    }
    // A continuous seam wraps two interlocking leather panels around the ball.
    function seam(t) {
        return new THREE.Vector3(.75 * Math.cos(t) + .25 * Math.cos(3 * t),
            .75 * Math.sin(t) - .25 * Math.sin(3 * t),
            Math.sqrt(.75) * Math.sin(2 * t)).multiplyScalar(radius);
    }
    for (let part = 0; part < 36; part++) {
        const points = [];
        for (let j = 0; j <= 28; j++) {
            const t = (part + .02 + j / 28 * .95) / 36 * Math.PI * 2;
            points.push(seam(t));
        }
        pen(points, .011, part * .7);
    }
    const holes = [];
    for (let i = 0; i < 108; i++) {
        const t = (i + .12 * (random() - .5)) / 108 * Math.PI * 2;
        const center = seam(t);
        const tangent = seam(t + .001).sub(seam(t - .001)).normalize();
        const sideways = center.clone().normalize().cross(tangent).normalize();
        const spread = .034 + random() * .013;
        const lean = .021 + random() * .009;
        for (const sign of [-1, 1]) {
            const points = [];
            for (let j = 0; j <= 8; j++) {
                const u = j / 8;
                const p = center.clone().addScaledVector(sideways, sign * (.005 + u * spread))
                    .addScaledVector(tangent, lean * (.45 - u) + .003 * Math.sin(u * Math.PI))
                    .normalize().multiplyScalar(radius * 1.01);
                points.push(p);
            }
            pen(points, .014 + random() * .005, i + sign);
            holes.push(points.at(-1));
        }
    }
    const ribbons = new THREE.BufferGeometry();
    ribbons.setAttribute('position', new THREE.Float32BufferAttribute(ribbonPositions, 3));
    ribbons.setIndex(ribbonIndices);
    object.add(new THREE.Mesh(ribbons, ink));
    const holeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.0065, 5, 4), ink, holes.length);
    const matrix = new THREE.Matrix4();
    holes.forEach((point, i) => { matrix.makeTranslation(point.x, point.y, point.z); holeMesh.setMatrixAt(i, matrix); });
    object.add(holeMesh);

    // Sparse broken hatching follows the leather. Leave the center mostly white.
    const hatches = [];
    const shade = new THREE.Vector3(.6, -.65, -.1).normalize();
    for (let i = 0; i < 5000; i++) {
        const y = random() * 2 - 1, angle = random() * Math.PI * 2;
        const n = new THREE.Vector3(Math.sqrt(1 - y * y) * Math.cos(angle), y,
            Math.sqrt(1 - y * y) * Math.sin(angle));
        const density = .05 + .7 * Math.max(0, n.dot(shade)) ** 2;
        if (random() > density) continue;
        const direction = new THREE.Vector3(1, .35, .2).projectOnPlane(n).normalize();
        const length = .012 + random() * .065;
        const a = n.clone().multiplyScalar(radius).addScaledVector(direction, -length / 2)
            .normalize().multiplyScalar(radius * 1.003);
        const b = n.clone().multiplyScalar(radius).addScaledVector(direction, length / 2)
            .normalize().multiplyScalar(radius * 1.003);
        hatches.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const hatchGeometry = new THREE.BufferGeometry();
    hatchGeometry.setAttribute('position', new THREE.Float32BufferAttribute(hatches, 3));
    object.add(new THREE.LineSegments(hatchGeometry, new THREE.LineBasicMaterial({ color: 0x343434 })));
    object.rotation.set(.12, -.14, -.72);

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
