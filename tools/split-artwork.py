"""Split existing artwork without changing passwords or recompressing textures.
Usage: python3 tools/split-artwork.py --full-password-file /local/password-file
The restricted password is requested locally, never written to the site.
"""
import argparse, base64, copy, getpass, hashlib, json, os, re
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def decode(value):
    return base64.b64decode(value)


def key_for(password, scope):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), decode(scope['salt']), scope['iterations'], 32)


def decrypt(payload, key):
    return json.loads(AESGCM(key).decrypt(decode(payload['iv']), decode(payload['ciphertext']), None))


def source(bundle, name):
    return decode(bundle['files'][name]).decode()


def encoded(text):
    return base64.b64encode(text.encode()).decode()


NAVIGATION = """
const slugs=globalThis.__ramblingsObjects;
const selected=globalThis.__ramblingsSelected;
function navigate(direction){
 const index=slugs.indexOf(selected),slug=slugs[(index+direction+slugs.length)%slugs.length];
 const url=new URL(location.href);url.pathname='/rambling-'+slug+'.html';url.searchParams.delete('object');
 location.assign(url.href);
}
for(const [id,direction] of [['previous-object',-1],['next-object',1]]){
 document.getElementById(id).addEventListener('click',e=>{e.stopImmediatePropagation();navigate(direction);},true);
}
function navigationKey(e){
 if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
 if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
 e.preventDefault();e.stopImmediatePropagation();navigate(e.key==='ArrowLeft'?-1:1);
}
document.addEventListener('keydown',navigationKey,true);
"""


def split_bundle(bundle, baseball_source):
    files=bundle['files']
    common={p:v for p,v in files.items() if p.startswith('assets/vendor/three/') or p=='assets/ink-lettering.js'}
    # Keep the original watermelon rendering and gestures; omit the unused baseball.
    melon=copy.deepcopy(common)
    melon.update({p:v for p,v in files.items() if p in ['assets/watermelon-spin.js','assets/textures/artwork-state.js'] or (p.startswith('assets/textures/') and 'baseball' not in p)})
    writing=source(bundle,'assets/ramblings.js')
    melon['assets/ramblings.js']=encoded(writing[:writing.index('export const baseballRambling')])
    code=source(bundle,'assets/watermelon.js')
    code=re.sub(r"import \{ createBaseball \} from [^;]+;\n",'',code)
    code=code.replace('firstRambling, flowRambling, baseballRambling','firstRambling, flowRambling')
    code=code.replace("const mount =", "const baseballRambling=[];\nconst mount =",1)
    code=code.replace("['rind', 'flesh', 'writing', 'seed-flow', 'baseball-writing', 'baseball-marks']", "['rind', 'flesh', 'writing', 'seed-flow']")
    code=code.replace('const baseball = createBaseball(baseballWritingTexture, baseballMarksTexture);', 'const baseball = {object:new THREE.Group(),shadow:new THREE.Group(),shell:new THREE.Mesh(),radius:1.08};')
    melon['assets/watermelon.js']=encoded(code)
    melon['assets/ramblings-page.js']=encoded(NAVIGATION+"\nawait import('./watermelon.js');")
    ball=copy.deepcopy(common)
    ball.update({p:v for p,v in files.items() if p.startswith('assets/baseball') or p.startswith('assets/textures/baseball')})
    ball['assets/ramblings.js']=encoded(writing[writing.index('export const baseballRambling'):])
    ball['assets/home-gallery.js']=encoded(baseball_source)
    ball['assets/ramblings-page.js']=encoded(NAVIGATION+"\nawait import('./home-gallery.js');")
    cat={p:v for p,v in files.items() if p.startswith('assets/shedding/')}
    cat['assets/ramblings-page.js']=encoded(NAVIGATION+"""
const frame=document.createElement('iframe');frame.id='caterpillar-frame';
frame.title='You misunderstand me — scroll animation and poem';
frame.addEventListener('load',()=>frame.contentDocument.addEventListener('keydown',navigationKey,true));
frame.srcdoc=globalThis.__ramblingsCaterpillarHTML;
document.querySelector('main').append(frame);
document.querySelector('#scene').hidden=true;
document.querySelector('.hint').hidden=true;
document.querySelector('#object-nav').hidden=false;
document.title='You misunderstand me — Ramblings — Alexander Atalla';
""")
    return {slug:{'html':bundle['html'],'files':contents} for slug,contents in [('watermelon',melon),('baseball',ball),('caterpillar',cat)]}


def build(root, full_password, home_password, baseball_source):
    root=Path(root)
    manifest=json.loads((root/'ramblings-access.json').read_text())
    keys={}
    for scope in manifest['scopes']:
        key=key_for(full_password if scope['id']=='all' else home_password, scope)
        proof=AESGCM(key).decrypt(decode(scope['probe']['iv']), decode(scope['probe']['ciphertext']), None)
        if proof.decode()!='ramblings-access:'+scope['id']:
            raise ValueError('Password did not verify')
        keys[scope['id']]=key
    full_scope=next(s for s in manifest['scopes'] if s['id']=='all')
    bundle=decrypt(json.loads((root/full_scope['file']).read_text()),keys['all'])
    objects=split_bundle(bundle,baseball_source)
    # Fail before publishing if any object's static module dependency is missing.
    from posixpath import normpath, join, dirname
    for slug, object_bundle in objects.items():
        for name, value in object_bundle['files'].items():
            if not name.endswith('.js'): continue
            code=decode(value).decode()
            for match in re.finditer(r"(?:from\s*|import\s*\(\s*|import\s*)['\"](\.[^'\"]+)['\"]",code):
                dependency=normpath(join(dirname(name),match.group(1).split('?')[0]))
                if dependency not in object_bundle['files']:
                    raise ValueError(f'Missing dependency in {slug}: {dependency}')
    output=root/'artwork';output.mkdir(exist_ok=True)
    report=[]
    for scope in manifest['scopes']:
        scope['objects']={}
        for slug,bundle in objects.items():
            if scope['id']=='home' and slug=='watermelon': continue
            iv=os.urandom(12)
            data=json.dumps(bundle,separators=(',',':')).encode()
            encrypted=AESGCM(keys[scope['id']]).encrypt(iv,data,None)
            payload={'version':1,'salt':scope['salt'],'iterations':scope['iterations'],'iv':base64.b64encode(iv).decode(),'ciphertext':base64.b64encode(encrypted).decode()}
            encoded_payload=json.dumps(payload,separators=(',',':')).encode()
            digest=hashlib.sha256(encoded_payload).hexdigest()
            filename=f'artwork/{scope["id"]}-{slug}-{digest[:16]}.encrypted.json'
            (root/filename).write_bytes(encoded_payload)
            scope['objects'][slug]={'file':filename,'sha256':digest}
            report.append({'scope':scope['id'],'object':slug,'bytes':len(encoded_payload)})
    # Publish pointers last. Legacy bundles remain for cached older loaders.
    (root/'ramblings-access.json').write_text(json.dumps(manifest,separators=(',',':')))
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--full-password-file',required=True)
    parser.add_argument('--baseball-source',required=True)
    args=parser.parse_args()
    report=build(Path(__file__).resolve().parents[1],Path(args.full_password_file).read_text().strip(),getpass.getpass('Restricted artwork password: '),Path(args.baseball_source).read_text())
    print(json.dumps(report,indent=2))
