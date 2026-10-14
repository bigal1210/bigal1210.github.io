import {readUnlock, verifyUnlock, rememberUnlock, forgetUnlock} from './ramblings-session.js?v=persistent-1';
const decode = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const encode = value => new TextEncoder().encode(value);
export async function loadProtectedPoems() {
    const saved = readUnlock();
    if (!saved) return {poems:[], dispose(){}};
    const accessResponse = await fetch('/ramblings-access.json', {cache:'no-store'});
    if (!accessResponse.ok) throw new Error('Access unavailable');
    const access = await accessResponse.json();
    if (access.version !== 1 || !Array.isArray(access.scopes)) throw new Error('Unsupported access');
    const verified = await verifyUnlock(access, saved);
    if (!verified) { forgetUnlock(); return {poems:[], dispose(){}}; }
    const response = await fetch('/poems.encrypted.json', {cache:'no-store'});
    if (!response.ok) throw new Error('Poems unavailable');
    const payload = await response.json();
    if (payload.version !== 1 || !Array.isArray(payload.scopes)) throw new Error('Unsupported poems');
    const envelope = payload.scopes.find(s => s.id === verified.scope && s.salt === verified.salt);
    if (!envelope) return {poems:[], dispose(){}};
    const credential = await crypto.subtle.importKey('raw', decode(verified.key), 'AES-GCM', false, ['decrypt']);
    const contentKey = await crypto.subtle.decrypt({name:'AES-GCM', iv:decode(envelope.iv), additionalData:encode('protected-poems:key:v1:'+verified.scope)}, credential, decode(envelope.ciphertext));
    const key = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['decrypt']);
    const bytes = await crypto.subtle.decrypt({name:'AES-GCM', iv:decode(payload.iv), additionalData:encode('protected-poems:v1')}, key, decode(payload.ciphertext));
    const bundle = JSON.parse(new TextDecoder().decode(bytes));
    const urls = [];
    const image = (data, type) => {const url = URL.createObjectURL(new Blob([decode(data)], {type})); urls.push(url); return url;};
    const dispose = () => urls.forEach(url => URL.revokeObjectURL(url));
    try {
        const poems = bundle.poems.map(({photo, icon, ...poem}) => ({...poem, imageUrl:image(photo,'image/jpeg'), iconUrl:image(icon,'image/png')}));
        rememberUnlock(verified);
        return {poems, dispose};
    } catch (error) { dispose(); throw error; }
}
