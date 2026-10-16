// Persist encrypted bytes only. Credentials and decrypted artwork never enter this cache.
const cacheName = 'ramblings-encrypted-v1';
export async function fetchEncryptedArtwork(entry) {
    const url = new URL(entry.file, location.href).href;
    let cache;
    if (entry.sha256) {
        try { cache = await caches.open(cacheName); } catch { /* Storage can be disabled. */ }
    }
    let response;
    try { response = await cache?.match(url); } catch { /* Use the network. */ }
    const cached = !!response;
    if (!response) {
        response = await fetch(url, {cache: entry.sha256 ? 'default' : 'no-cache'});
        if (!response.ok) throw new Error('Could not download artwork');
    }
    const bytes = await response.arrayBuffer();
    if (entry.sha256) {
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
        if (hash !== entry.sha256) {
            try { await cache?.delete(url); } catch {}
            throw new Error('Artwork integrity check failed; please retry');
        }
        try { if (!cached) await cache?.put(url, new Response(bytes, {headers: {'Content-Type':'application/json'}})); } catch { /* Quota must not prevent opening. */ }
    }
    return JSON.parse(new TextDecoder().decode(bytes));
}
