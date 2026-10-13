// Remember the derived credential, never the typed password. Access is rechecked
// against the encrypted proof so a changed password invalidates an old unlock.
const name = 'ramblings-unlock:v2';
const stores = () => {
    const available = [];
    for (const kind of ['localStorage', 'sessionStorage']) {
        try { available.push(globalThis[kind]); } catch {}
    }
    return available;
};
export function readUnlock(legacyName) {
    for (const storage of stores()) {
        for (const key of [name, legacyName].filter(Boolean)) {
            try {
                const raw = storage.getItem(key);
                if (!raw) continue;
                const saved = JSON.parse(raw);
                if (typeof saved?.salt === 'string' && typeof saved?.key === 'string') return saved;
                storage.removeItem(key);
            } catch { try { storage.removeItem(key); } catch {} }
        }
    }
    return null;
}
export function rememberUnlock(saved) {
    for (const storage of stores()) {
        try { storage.setItem(name, JSON.stringify(saved)); } catch {}
    }
}
export function forgetUnlock(legacyName) {
    for (const storage of stores()) {
        for (const key of [name, legacyName].filter(Boolean)) {
            try { storage.removeItem(key); } catch {}
        }
    }
}
export const canOpen = (scope, slug) => scope === 'all' ||
    (scope === 'home' && ['baseball', 'caterpillar'].includes(slug));
export async function verifyUnlock(access, saved) {
    const decode = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
    for (const candidate of access.scopes) {
        if (candidate.iterations !== 600000 || !['all', 'home'].includes(candidate.id) || candidate.salt !== saved.salt) continue;
        try {
            const key = await crypto.subtle.importKey('raw', decode(saved.key), 'AES-GCM', false, ['decrypt']);
            const proof = await crypto.subtle.decrypt({name:'AES-GCM', iv:decode(candidate.probe.iv)}, key, decode(candidate.probe.ciphertext));
            if (new TextDecoder().decode(proof) === 'ramblings-access:' + candidate.id) return {...saved, scope:candidate.id};
        } catch { /* Invalid or outdated credentials must prompt again. */ }
    }
    return null;
}
