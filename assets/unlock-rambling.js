import {fetchEncryptedArtwork} from './encrypted-artwork.js?v=split-1';
        import {readUnlock, rememberUnlock, forgetUnlock} from './ramblings-session.js?v=persistent-1';
        const requestedObject = new URL(location.href).searchParams.get('object')
            ?? location.pathname.match(/rambling-(watermelon|baseball|caterpillar)\.html$/)?.[1]
            ?? (new URL(location.href).searchParams.get('preview') === 'baseball-writing' ? 'baseball' : 'watermelon');
        if (!['watermelon','baseball','caterpillar'].includes(requestedObject)) throw new Error('Unknown artwork');
        const form = document.querySelector('#unlock');
        const input = document.querySelector('#password');
        const button = form.querySelector('button');
        const status = document.querySelector('#status');
        const decode = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
        const text = value => new TextDecoder().decode(decode(value));
        // Remember a verified unlock across visits; never store the typed password.
        const legacySessionName = `ramblings-unlock:${location.pathname}`;
        function forgetSession() {
            forgetUnlock(legacySessionName);
        }
        let busy = false;
        async function unlock(saved = null) {
            if (busy) return;
            if (!globalThis.crypto?.subtle) {
                status.textContent = 'Please open this page over HTTPS, or use localhost for the preview.';
                return;
            }
            busy = true;
            button.disabled = true;
            form.setAttribute('aria-busy', 'true');
            status.textContent = 'Opening…';
            const urls = [];
            let stage = 'download';
            try {
                const response = await fetch('ramblings-access.json', { cache: 'no-store' });
                if (!response.ok) throw new Error('Could not download access information');
                const access = await response.json();
                if (access.version !== 1 || !Array.isArray(access.scopes)) throw new Error('Unsupported access information');
                stage = 'password';
                let key, scope;
                const material = saved ? null : await crypto.subtle.importKey('raw', new TextEncoder().encode(input.value), 'PBKDF2', false, ['deriveKey']);
                input.value = '';
                for (const candidate of access.scopes) {
                    if (candidate.iterations !== 600000 || !['all', 'home'].includes(candidate.id)) continue;
                    if (candidate.id === 'home' && requestedObject === 'watermelon') continue;
                    if (saved && saved.salt !== candidate.salt) continue;
                    try {
                        const trialKey = saved
                            ? await crypto.subtle.importKey('raw', decode(saved.key), 'AES-GCM', true, ['decrypt'])
                            : await crypto.subtle.deriveKey(
                                { name: 'PBKDF2', salt: decode(candidate.salt), iterations: candidate.iterations, hash: 'SHA-256' },
                                material, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
                        const proof = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(candidate.probe.iv) }, trialKey, decode(candidate.probe.ciphertext));
                        if (new TextDecoder().decode(proof) !== 'ramblings-access:' + candidate.id) continue;
                        key = trialKey;
                        scope = candidate;
                        break;
                    } catch { /* This credential does not unlock this scope. */ }
                }
                if (!scope) throw new Error('Incorrect password');
                stage = 'download';
                const entry = scope.objects?.[requestedObject];
                if (scope.objects && !entry) throw new Error('This password does not open this object');
                const payload = await fetchEncryptedArtwork(entry ?? {file: scope.file});
                if (payload.version !== 1 || payload.iterations !== scope.iterations || payload.salt !== scope.salt) throw new Error('Unsupported content');
                const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(payload.iv) }, key, decode(payload.ciphertext));
                stage = 'open';
                const bundle = JSON.parse(new TextDecoder().decode(decrypted));
                const blob = (bytes, type) => {
                    const url = URL.createObjectURL(new Blob([bytes], { type }));
                    urls.push(url);
                    return url;
                };
                const modules = new Map();
                const resolving = new Set();
                function moduleURL(path) {
                    if (modules.has(path)) return modules.get(path);
                    if (resolving.has(path) || !bundle.files[path]) throw new Error(`Invalid module: ${path}`);
                    resolving.add(path);
                    const source = text(bundle.files[path]).replace(
                        /((?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*))(['"])(\.[^'"]+)\2/g,
                        (_, prefix, quote, specifier) => {
                            const dependency = new URL(specifier, `https://bundle.invalid/${path}`).pathname.slice(1);
                            return prefix + quote + moduleURL(dependency) + quote;
                        });
                    const url = blob(source, 'text/javascript');
                    modules.set(path, url);
                    resolving.delete(path);
                    return url;
                }
                const artwork = {};
                for (const path of Object.keys(bundle.files)) {
                    const match = /^assets\/textures\/([^/]+)\.png$/.exec(path);
                    if (match) artwork[match[1]] = blob(decode(bundle.files[path]), 'image/png');
                }
                let caterpillarHTML = '';
                if (bundle.files['assets/shedding/index.html']) {
                    const sheddingArtwork = {};
                    for (const path of Object.keys(bundle.files)) {
                        const match = /^assets\/shedding\/assets\/([^/]+)\.png$/.exec(path);
                        if (match) sheddingArtwork[match[1] + '.png'] = blob(decode(bundle.files[path]), 'image/png');
                    }
                    caterpillarHTML = text(bundle.files['assets/shedding/index.html']);
                    const stylesheet = blob(decode(bundle.files['assets/shedding/style.css']), 'text/css');
                    caterpillarHTML = caterpillarHTML.replace(/href="style\.css[^"]*"/, `href="${stylesheet}"`);
                    caterpillarHTML = caterpillarHTML.replace(/src="study\.js[^"]*"/, `src="${moduleURL('assets/shedding/study.js')}"`);
                    const artworkSetup = `<script>globalThis.__sheddingArtwork = ${JSON.stringify(sheddingArtwork)};<\/script>`;
                    caterpillarHTML = caterpillarHTML.replace('<head>', '<head>' + artworkSetup);
                }
                let html = bundle.html.replace(/<link\b[^>]*rel="preload"[^>]*>/g, '');
                html = html.replace(/src="assets\/ramblings-page\.js[^\"]*"/, `src="${moduleURL('assets/ramblings-page.js')}"`);
                const setup = `<script>globalThis.__ramblingsSelected = ${JSON.stringify(requestedObject)};globalThis.__ramblingsObjects = ${JSON.stringify(Object.keys(scope.objects ?? {watermelon:0,baseball:0,caterpillar:0}))};globalThis.__ramblingsArtwork = ${JSON.stringify(artwork)};globalThis.__ramblingsCaterpillarHTML = ${JSON.stringify(caterpillarHTML).replace(/</g, '\\u003c')};<\/script>`;
                html = html.replace('<head>', '<head>' + setup);
                try {
                    const bytes = new Uint8Array(await crypto.subtle.exportKey('raw', key));
                    rememberUnlock({
                        scope: scope.id, salt: payload.salt, key: btoa(String.fromCharCode(...bytes))
                    });
                } catch {
                    // Storage may be disabled; unlocking still works for this visit.
                }
                if (requestedObject === 'watermelon') {
                    // Own touch gestures rather than handing vertical drags to Safari.
                    html = html.replace('<head>', '<head><meta name="theme-color" content="#ffffff"><style>html,body{height:100%;overflow:hidden;overscroll-behavior:none;background:#fff}body{position:fixed;inset:0;width:100%}main,#scene{height:100%;height:100dvh}#scene canvas{touch-action:none}</style>');
                }
                if (new URL(location.href).searchParams.has('embedded')) {
                    html = html.replace('<head>', '<head><style>body>header,#object-nav,.hint{display:none!important}</style>');
                }
                document.open();
                document.write(html);
                document.close();
            } catch (error) {
                for (const url of urls) URL.revokeObjectURL(url);
                if (saved && stage === 'password') forgetSession();
                status.textContent = stage === 'password'
                    ? (saved ? '' : 'That password didn’t open it. Try again.')
                    : stage === 'download'
                        ? 'Couldn’t load the page. Check your connection and try again.'
                        : 'Couldn’t open the artwork. Please reload and try again.';
                input.focus();
            } finally {
                busy = false;
                button.disabled = false;
                form.removeAttribute('aria-busy');
            }
        }
        form.addEventListener('submit', event => {
            event.preventDefault();
            unlock();
        });
        const saved = readUnlock(legacySessionName);
        if (saved) unlock(saved);
