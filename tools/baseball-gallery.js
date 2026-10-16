import * as THREE from './vendor/three/three.module.js';
import {createBaseball} from './baseball.js';
import {baseballRambling} from './ramblings.js';
const mount=document.querySelector('#scene');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1.25;mount.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,100);
scene.add(new THREE.HemisphereLight(0xffffff,0x999999,2.5));
const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(-3,5,6);scene.add(key);
const fill=new THREE.DirectionalLight(0xffffff,.65);fill.position.set(4,-1,2);scene.add(fill);
const loader=new THREE.TextureLoader();
const textures=await Promise.all(['baseball-writing','baseball-marks'].map(async name=>{
 const texture=await loader.loadAsync(globalThis.__ramblingsArtwork[name]);texture.colorSpace=THREE.SRGBColorSpace;
 texture.anisotropy=renderer.capabilities.getMaxAnisotropy();return texture;
}));
const baseball=createBaseball(...textures);scene.add(baseball.object,baseball.shadow);
baseball.shadow.position.set(.05,-baseball.radius-.03,-.45);
document.querySelector('#baseball-text').textContent=baseballRambling.map(t=>t.replace(/^\./,'')).join('\n\n');
const slugs=['baseball','caterpillar'],names=['Baseball','You misunderstand me'];
const prev=document.querySelector('#previous-object'),next=document.querySelector('#next-object'),hint=document.querySelector('.hint');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let active=fromURL(),frame,zoom=1,targetZoom=1,pointer=null,zoomAnchor=null;
const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),0),point=new THREE.Vector3();
function fromURL(){const url=new URL(location.href),slug=url.searchParams.get('object')??url.pathname.match(/rambling-([^/]+)\.html$/)?.[1];return Math.max(0,slugs.indexOf(slug));}
function distance(){return camera.aspect<1?6.3/camera.aspect:6.3;}
function keydown(event){if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();show(1-active);}
function show(index,historyMode='pushState'){
 active=index===1?1:0;
 const url=new URL(location.href);url.pathname='/rambling-'+slugs[active]+'.html';url.searchParams.delete('object');
 if(url.href!==location.href)history[historyMode](null,'',url);
 for(const rel of ['icon','apple-touch-icon']){let icon=document.querySelector(`link[rel="${rel}"]`);if(!icon){icon=document.createElement('link');icon.rel=rel;document.head.append(icon);}icon.href='/assets/icons/'+slugs[active]+'.png?v=2';}
 document.title=names[active]+' — Ramblings — Alexander Atalla';
 if(active===1&&!frame){frame=document.createElement('iframe');frame.id='caterpillar-frame';frame.title='You misunderstand me — scroll animation and poem';frame.srcdoc=globalThis.__ramblingsCaterpillarHTML;frame.addEventListener('load',()=>frame.contentDocument.addEventListener('keydown',keydown));document.querySelector('main').append(frame);}
 if(frame)frame.hidden=active!==1;
 mount.hidden=active===1;hint.hidden=active===1;baseball.object.visible=baseball.shadow.visible=active===0;
 mount.dataset.object=slugs[active];mount.setAttribute('aria-describedby','baseball-text');
 mount.setAttribute('aria-label','Amadou Barry quote written on a baseball. Drag to turn or scroll to read the writing up close.');
 document.querySelector('#baseball-text').hidden=active!==0;
 document.querySelector('#object-status').textContent=names[active]+', '+(active+1)+' of 2';
 prev.setAttribute('aria-label','Previous object: '+names[1-active]);next.setAttribute('aria-label','Next object: '+names[1-active]);
 zoom=targetZoom=1;zoomAnchor=null;pointer=null;camera.position.set(0,0,distance());camera.zoom=1;camera.updateProjectionMatrix();
}
prev.addEventListener('click',()=>show(1-active));next.addEventListener('click',()=>show(1-active));
document.addEventListener('keydown',keydown);addEventListener('popstate',()=>show(fromURL(),'replaceState'));
function surface(x,y){const rect=renderer.domElement.getBoundingClientRect();const screen=new THREE.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);camera.updateMatrixWorld();baseball.object.updateWorldMatrix(true,true);ray.setFromCamera(screen,camera);return {screen,hit:ray.intersectObject(baseball.shell,false)[0]};}
function changeZoom(delta,x,y){const z=THREE.MathUtils.clamp(targetZoom*Math.exp(-delta),.003,2.4);if(z===targetZoom)return;const {screen,hit}=surface(x,y);if(hit)zoomAnchor={screen,point:baseball.object.worldToLocal(hit.point.clone()),object:baseball.object};else{const p=ray.ray.intersectPlane(plane,new THREE.Vector3());zoomAnchor=p?{screen,point:p}:null;}targetZoom=z;}
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?mount.clientHeight:1;changeZoom(THREE.MathUtils.clamp(e.deltaY*unit,-150,150)*(e.ctrlKey?-.004:.0018),e.clientX,e.clientY);},{passive:false});
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0||pointer)return;const {hit}=surface(e.clientX,e.clientY);zoomAnchor=null;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,pan:zoom<.15,z:hit?.point.z??0};renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.style.cursor='grabbing';});
renderer.domElement.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;if(pointer.pan){const scale=2*(camera.position.z-pointer.z)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/camera.zoom/mount.clientHeight;camera.position.x-=(e.clientX-pointer.x)*scale;camera.position.y+=(e.clientY-pointer.y)*scale;}else{baseball.object.rotation.y+=(e.clientX-pointer.x)*.006;baseball.object.rotation.x+=(e.clientY-pointer.y)*.006;}pointer.x=e.clientX;pointer.y=e.clientY;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(event,e=>{if(pointer?.id===e.pointerId){pointer=null;renderer.domElement.style.cursor='grab';if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);}});
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();zoomAnchor=null;}
addEventListener('resize',resize);resize();show(active,'replaceState');
let first=true;
renderer.setAnimationLoop(()=>{
 if(active===1&&!first)return;
 zoom+=(targetZoom-zoom)*(reduced?1:.09);camera.position.z=distance()*Math.max(zoom,.3);camera.zoom=Math.max(1,.3/zoom);camera.updateProjectionMatrix();
 if(zoomAnchor){point.copy(zoomAnchor.point);if(zoomAnchor.object)zoomAnchor.object.localToWorld(point);const h=(camera.position.z-point.z)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/camera.zoom;camera.position.x=point.x-zoomAnchor.screen.x*h*camera.aspect;camera.position.y=point.y-zoomAnchor.screen.y*h;}
 renderer.render(scene,camera);
 if(first){first=false;document.querySelector('#loading').hidden=true;document.querySelector('#object-nav').hidden=false;mount.dataset.ready='true';}
});
