import * as THREE from './vendor/three/three.module.js';

// The clear strip outside the lettering, just inside the outer ink contour.
export function inSpinBand(point) {
    if (!point) return false;
    const radius = Math.hypot(point.x, point.y);
    return radius >= 1.80 && radius <= 1.90;
}

export function pointerOnFace(camera, inverseMelonMatrix, bounds, x, y) {
    const screen = new THREE.Vector2(
        (x - bounds.left) / bounds.width * 2 - 1,
        1 - (y - bounds.top) / bounds.height * 2);
    camera.updateMatrixWorld();
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(screen, camera);
    const ray = raycaster.ray.applyMatrix4(inverseMelonMatrix);
    // The band cannot be grabbed through the back or when viewed edge-on.
    if (ray.direction.z >= -.001) return null;
    return ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -.005), new THREE.Vector3());
}

export function angleStep(previous, current) {
    const delta = current - previous;
    return Math.atan2(Math.sin(delta), Math.cos(delta));
}
