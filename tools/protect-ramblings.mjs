import { readFile, writeFile, mkdir, readdir, cp, rm } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';

// Build a publishable static site; never overwrite the editable artwork.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, '.protected-site');
const password = process.env.RAMBLINGS_PASSWORD;
if (!password) {
    throw new Error('Set RAMBLINGS_PASSWORD to a nonempty password. See tools/RAMBLINGS-PASSWORD.md.');
}
const files = {};
async function collect(directory) {
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
        const name = `${directory}/${entry.name}`;
        if (entry.isDirectory()) await collect(name);
        else if (entry.isFile()) files[name] = (await readFile(join(root, name))).toString('base64');
        else throw new Error(`Unsupported asset: ${name}`);
    }
}
await collect('assets');
const html = await readFile(join(root, 'nothinghereyet.html'), 'utf8');
// Blob modules have no filesystem directory. Preserve the drawing code and
// resolve its four existing textures from decrypted, in-memory image URLs.
const artworkURL = "new URL(`./textures/${name}.png${name === 'seed-flow' ? '?v=phrases-2' : ''}`, import.meta.url).href";
const melon = Buffer.from(files['assets/watermelon.js'], 'base64').toString('utf8');
if (!melon.includes(artworkURL)) throw new Error('Artwork loader changed; update the protected build before publishing.');
files['assets/watermelon.js'] = Buffer.from(melon.replace(artworkURL, 'globalThis.__ramblingsArtwork[name]')).toString('base64');
const salt = randomBytes(16), iv = randomBytes(12), iterations = 600000;
const key = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
const cipher = createCipheriv('aes-256-gcm', key, iv);
const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify({ html, files })), cipher.final(), cipher.getAuthTag()
]);
const payload = { version: 1, iterations, salt: salt.toString('base64'), iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64') };
key.fill(0);
await mkdir(output, { recursive: true });
// This directory is generated and ignored by Git; remove stale plaintext too.
for (const entry of await readdir(output)) await rm(join(output, entry), { recursive: true, force: true });
for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['assets', 'tools', 'nothinghereyet.html'].includes(entry.name)) continue;
    await cp(join(root, entry.name), join(output, entry.name), { recursive: true, dereference: false });
}
await writeFile(join(output, 'nothinghereyet.html'), await readFile(join(root, 'tools/ramblings-lock.html')));
await writeFile(join(output, 'ramblings.encrypted.json'), JSON.stringify(payload));
// Retain the library's attribution alongside its encrypted distribution.
await writeFile(join(output, 'THREE-LICENSE.txt'), await readFile(join(root, 'assets/vendor/three/LICENSE')));
console.log(`Protected site built at ${output}\nPublish only this directory. The source checkout is NOT password protected.`);
