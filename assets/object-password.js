import {readUnlock, rememberUnlock, forgetUnlock, verifyUnlock, canOpen} from './ramblings-session.js?v=persistent-1';
// Reuse the existing encrypted credential probes; no plaintext passwords are stored.
export function createObjectPasswordPrompt({prepare=async()=>{}}={}){
 const style=document.createElement('style');
 style.textContent=`
 #object-password{box-sizing:border-box;width:250px;height:30px;max-width:calc(100vw - 40px);max-height:calc(100svh - 40px);padding:0;margin:auto;border:0;border-radius:0;background:transparent;color:#111;box-shadow:none;font:300 12px 'IBM Plex Mono',monospace;overflow:visible}
 #object-password::backdrop{background:transparent}
 #object-password form{position:relative;margin:0}
 #object-password input{box-sizing:border-box;display:block;width:100%;height:30px;border:1px solid #000;border-radius:0;background:transparent;color:inherit;font:inherit;text-align:center;padding:0 8px;appearance:none}
 #object-password input::placeholder{color:#111;opacity:1}
 #object-password input:focus{outline:none}
 #object-password-status{position:absolute;top:100%;left:0;right:0;font:inherit;line-height:1.6;margin:16px 0 0;color:#777;text-align:center}
 `;
 document.head.append(style);
 const modal=document.createElement('dialog');modal.id='object-password';modal.setAttribute('aria-label','Enter password');
 modal.innerHTML=`<form><input aria-label="Password" name="password" type="password" autocomplete="current-password" aria-describedby="object-password-status" placeholder="password" enterkeyhint="go" required><button type="submit" hidden>Unlock</button><p id="object-password-status" role="status" aria-live="polite"></p></form>`;
 document.body.append(modal);
 const form=modal.querySelector('form'),input=modal.querySelector('input'),status=modal.querySelector('[role=status]');
 const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
 let request=null,generation=0,busy=false,pendingController=null;
 const finish=allowed=>{if(!request)return;const current=request;request=null;generation++;busy=false;current.controller.abort();if(pendingController===current.controller)pendingController=null;input.value='';input.readOnly=false;input.disabled=false;form.removeAttribute('aria-busy');if(modal.open)modal.close();current.trigger?.focus({preventScroll:true});current.resolve(allowed);};
 modal.addEventListener('click',event=>{
  if(event.target!==modal)return;
  const bounds=modal.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)finish(false);
 });
 modal.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
 modal.addEventListener('close',()=>{if(!modal.open)finish(false);});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!request||busy)return;
  const token=generation,slug=request.slug;busy=true;input.readOnly=true;form.setAttribute('aria-busy','true');status.textContent='Opening…';
  let stage='download';
  try{
   if(!crypto.subtle)throw new Error('Web Crypto unavailable');
   const response=await fetch(new URL('../ramblings-access.json',import.meta.url),{cache:'no-store'});
   if(!response.ok)throw new Error('Access information unavailable');
   const access=await response.json();if(access.version!==1||!Array.isArray(access.scopes))throw new Error('Unsupported access information');
   if(token!==generation)return;
   stage='password';
   const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(input.value),'PBKDF2',false,['deriveKey']);
   let scope=null,credential=null;
   for(const candidate of access.scopes){
    if(token!==generation)return;
    if(candidate.iterations!==600000||!['all','home'].includes(candidate.id))continue;
    try{
     const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:decode(candidate.salt),iterations:candidate.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},true,['decrypt']);
     const proof=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(candidate.probe.iv)},key,decode(candidate.probe.ciphertext));
     if(new TextDecoder().decode(proof)==='ramblings-access:'+candidate.id){scope=candidate.id;credential={key,salt:candidate.salt};break;}
    }catch{/* Try the other existing credential. */}
   }
   if(token!==generation)return;
   if(!scope){input.value='';status.textContent='That password didn’t open it. Try again.';return;}
   if(!canOpen(scope,slug)){status.textContent='That password doesn’t open this object.';return;}
   const bytes=new Uint8Array(await crypto.subtle.exportKey('raw',credential.key));
   if(token!==generation)return;
   rememberUnlock({scope,salt:credential.salt,key:btoa(String.fromCharCode(...bytes))});
   stage='open';
   await prepare(slug,request.controller.signal);
   if(token!==generation)return;
   finish(true);
  }catch{
   if(token===generation)status.textContent=stage==='open'?'Couldn’t open the artwork. Try again.':stage==='download'?'Couldn’t load the password check. Try again.':'That password didn’t open it. Try again.';
  }finally{
   if(token===generation){busy=false;input.readOnly=false;input.disabled=false;form.removeAttribute('aria-busy');input.focus();}
  }
 });
 return async slug=>{
  if(request)finish(false);
  pendingController?.abort();
  const controller=new AbortController();pendingController=controller;
  const token=++generation,saved=readUnlock();let openingError='';
  if(saved){
   try{
    const response=await fetch(new URL('../ramblings-access.json',import.meta.url),{cache:'no-store'});
    if(!response.ok)throw new Error('Access information unavailable');
    const access=await response.json();if(access.version!==1||!Array.isArray(access.scopes))throw new Error('Unsupported access information');
    const verified=await verifyUnlock(access,saved);
    if(token!==generation)return false;
    if(!verified)forgetUnlock();
    else if(canOpen(verified.scope,slug)){
     rememberUnlock(verified);
     try{await prepare(slug,controller.signal);if(token!==generation)return false;pendingController=null;return true;}
     catch{if(token!==generation)return false;openingError='Couldn’t open the artwork. Try again.';}
    }
   }catch{/* Keep saved access during a temporary network failure. */}
  }
  if(token!==generation)return false;
  return new Promise(resolve=>{generation++;request={slug,resolve,controller,trigger:document.activeElement};status.textContent=openingError;input.value='';input.readOnly=false;input.disabled=false;modal.showModal();input.focus();});
 };
}
