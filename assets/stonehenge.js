import * as THREE from './vendor/three/three.module.js';
import { createObjectPasswordPrompt } from './object-password.js?v=ready-transition-1';
import { solarPosition, permittedLocation, SAN_FRANCISCO } from './sun-cycle.js';

// A living monument. Each occupied position replaces one stone; new writing can
// take over another slot without changing the shape of its object.
const INK = 0x372a24, PAPER = 0xf3eadb;
const mount = document.querySelector('#scene');
const style = document.createElement('style');
style.textContent = `
body{background:#f3eadb;color:#47372c}header{z-index:4}header h1{letter-spacing:.16em;text-transform:uppercase;font-size:10px}
#scene{position:fixed;inset:0;touch-action:none}#scene canvas{touch-action:none;outline:none}#scene canvas:focus-visible{outline:1px dashed #79644f;outline-offset:-8px}
.paper-grain{position:fixed;inset:0;pointer-events:none;z-index:2;opacity:.12;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='%239a8165' filter='url(%23n)' opacity='.5' d='M0 0h180v180H0z'/%3E%3C/svg%3E")}
.world-footer{justify-content:flex-end!important;position:fixed;bottom:27px;left:30px;right:30px;z-index:4;display:flex;align-items:end;justify-content:space-between;gap:20px;font-size:10px;line-height:1.9;letter-spacing:.035em}.world-footer p{margin:0;color:#897865}.world-footer nav{display:flex;gap:20px}button.world-button{font:inherit;color:inherit;border:0;background:none;padding:7px 0;cursor:pointer}button.world-button:hover{text-decoration:underline;text-underline-offset:5px}button:focus-visible{outline:1px dashed #685445;outline-offset:5px}.world-title{position:fixed;left:36px;top:95px;z-index:3;pointer-events:none}.world-title span{font-size:9px;letter-spacing:.19em;text-transform:uppercase;color:#8d7a63}.world-title h2{font-family:Georgia,serif;font-size:32px;line-height:1.2;font-weight:400;margin:9px 0;color:#554334}.world-title p{font-size:10px;color:#917c64;margin:0}
#world-tooltip{position:fixed;z-index:5;pointer-events:none;background:#f6efdfec;border:1px solid #bbae99;padding:8px 12px;font-size:10px;box-shadow:0 2px 12px #48331a0c}
#reading{position:fixed;inset:0;margin:0;padding:0;border:0;background:#fff;color:#47372c;width:100vw;height:100svh;max-width:none;max-height:none;overflow:hidden;box-shadow:none}#reading[data-preloading]{display:block;opacity:0;pointer-events:none;z-index:-1}#reading::backdrop{background:#fff}#reading iframe{display:block;width:100%;height:100%;border:0;background:#fff}#reading #close-reading{position:absolute;top:32px;left:36px;z-index:2;padding:0;border:0;border-radius:0;background:none;color:#47372c;font:inherit;font-size:12px;line-height:normal}#reading #close-reading::after{content:'';position:absolute;inset:-12px}#reading #close-reading:hover{text-decoration:none}@media(max-width:600px){#reading #close-reading{top:24px;left:22px}}#reading #close-reading:focus,#reading #close-reading:focus-visible{outline:none;box-shadow:none}.hint{display:none}

@media(max-width:600px){.world-title{left:22px;top:78px}.world-title h2{font-size:25px}.world-title p{font-size:9px}.world-footer{left:22px;right:22px;bottom:18px;flex-wrap:wrap;gap:4px}.world-footer nav{gap:17px}.world-footer p{width:100%}#reading{width:100vw;height:100svh;border:0}.reading-bar{padding:0 15px!important}}
`;
document.head.append(style);
mount.setAttribute('role', 'region');
mount.setAttribute('aria-label', 'Stonehenge in an endless paper universe. Drag to orbit, scroll or pinch to zoom. Select an object to read.');
mount.removeAttribute('aria-describedby');
document.body.insertAdjacentHTML('beforeend', `<div class="paper-grain" aria-hidden="true"></div>
<div class="world-footer"><nav class="sr-only" aria-label="Read a rambling"><button data-read="watermelon">Watermelon</button><button data-read="baseball">Baseball</button><button data-read="caterpillar">Caterpillar</button></nav><button class="world-button" id="reset-view">Reset view</button></div>
<div id="world-tooltip" hidden></div>
<dialog id="reading" aria-label="Rambling"><button class="world-button" id="close-reading" aria-label="Back to stones">←</button></dialog>`);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(PAPER);
renderer.outputColorSpace = THREE.SRGBColorSpace;
mount.append(renderer.domElement);
const canvas = renderer.domElement;
canvas.tabIndex = 0;
canvas.setAttribute('aria-label', 'Orbit view. Arrow keys turn, plus and minus zoom, Home resets.');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(39, 1, .1, 300);
let seed = 1109;
function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const ink = new THREE.MeshBasicMaterial({color:INK, side:THREE.BackSide});
const lineMaterial = new THREE.LineBasicMaterial({color:INK,transparent:true,opacity:.77});
// Groups of tapered curved strokes, drawn once and anchored to the stone.
// An independent random sequence preserves every existing stone and position.
let drawingSeed=48231;
function drawRandom(){drawingSeed=(drawingSeed*1664525+1013904223)>>>0;return drawingSeed/4294967296;}
function makeDrawing(dense){
 const sheet=document.createElement('canvas');sheet.width=sheet.height=1024;
 const ctx=sheet.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1024,1024);ctx.lineCap='round';
 for(let i=0;i<(dense?5200:2800);i++){
  const x=drawRandom()*1024,y=drawRandom()*1024,angle=-1.05+Math.sin(x*.009+y*.004)*.28+(drawRandom()-.5)*.3+(drawRandom()<.12?1.8:0);
  const count=1,length=24+drawRandom()*56,curve=(drawRandom()-.5)*14;
  for(let k=0;k<count;k++){
   const offset=k*(2.7+drawRandom()*1.6),len=length*(.55+drawRandom()*.6),sx=x+Math.cos(angle+Math.PI/2)*offset,sy=y+Math.sin(angle+Math.PI/2)*offset;
   const pressure=.65+drawRandom()*.75,alpha=.42+drawRandom()*.35;
   for(let j=0;j<12;j++){
    const t=j/12,u=(j+1)/12;
    const point=v=>[sx+Math.cos(angle)*len*v+Math.cos(angle+Math.PI/2)*Math.sin(v*Math.PI)*curve,sy+Math.sin(angle)*len*v+Math.sin(angle+Math.PI/2)*Math.sin(v*Math.PI)*curve];
    const p=point(t),q=point(u);ctx.lineWidth=pressure*(.25+.75*Math.sin((t+.04)*Math.PI));ctx.strokeStyle=`rgba(0,0,0,${alpha})`;
    ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();
   }
  }
 }
 const texture=new THREE.CanvasTexture(sheet);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return texture;
}
const paper = new THREE.ShaderMaterial({
 uniforms:{backTreatment:{value:0},paper:{value:new THREE.Color(PAPER)},ink:{value:new THREE.Color(INK)},lightMarks:{value:makeDrawing(false)},darkMarks:{value:makeDrawing(true)}},
 vertexShader:`varying vec3 vN;varying vec3 vP;varying vec3 localN;varying vec2 offset;
 void main(){vN=normalize(mat3(modelMatrix)*normal);localN=normal;vP=position;offset=modelMatrix[3].xz*.071;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform float backTreatment;uniform vec3 paper;uniform vec3 ink;uniform sampler2D lightMarks;uniform sampler2D darkMarks;
 varying vec3 vN;varying vec3 vP;varying vec3 localN;varying vec2 offset;
 float drawing(vec2 uv,float shade){
 vec2 p=uv*.105+offset;
 float fine=1.-texture2D(lightMarks,p).r;
 float deep=1.-texture2D(darkMarks,p+vec2(.37,.61)).r;
 // Only the darkest stone faces receive the softer shading.
 float back=backTreatment*smoothstep(.8,1.,shade);
 vec2 d=vec2(.001,0.);
 float softFine=1.-(texture2D(lightMarks,p+d).r+texture2D(lightMarks,p-d).r+texture2D(lightMarks,p+d.yx).r+texture2D(lightMarks,p-d.yx).r)*.25;
 vec2 q=p+vec2(.37,.61);
 float softDeep=1.-(texture2D(darkMarks,q+d).r+texture2D(darkMarks,q-d).r+texture2D(darkMarks,q+d.yx).r+texture2D(darkMarks,q-d.yx).r)*.25;
 fine=mix(fine,softFine,back*.65);deep=mix(deep,softDeep,back*.65);
 float value=fine*(.065+.75*smoothstep(.36,.95,shade));
 value=1.-(1.-value)*(1.-deep*smoothstep(.55,1.,shade)*.55);
 return value*(1.-back*.25);
 }
 void main(){vec3 n=normalize(vN);float shade=1.-max(dot(n,normalize(vec3(-.8,1.,.6))),0.);
 vec3 weights=pow(abs(normalize(localN)),vec3(8.));weights/=weights.x+weights.y+weights.z;
 float h=drawing(vP.zy,shade)*weights.x+drawing(vP.xz,shade)*weights.y+drawing(vP.xy,shade)*weights.z;
 gl_FragColor=vec4(mix(paper,ink,min(.85,h*1.6)),1.);
 #include <colorspace_fragment>
 }`
});

const stonePaper=paper.clone();stonePaper.uniforms.backTreatment.value=1;

function outlined(geometry,parent,position=[0,0,0],scale=[1,1,1]){
 const group=new THREE.Group();group.position.set(...position);group.scale.set(...scale);
 const mesh=new THREE.Mesh(geometry,paper);group.add(mesh);
 const contour=new THREE.Mesh(geometry,ink);contour.scale.setScalar(1.016);group.add(contour);
 parent.add(group);return group;
}
function stroke(points,parent,opacity=.8){const mat=lineMaterial.clone();mat.opacity=opacity;const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),mat);parent.add(line);return line;}
function stoneGeometry(w,h,d){
 const shape=[[-.35,-.5],[.32,-.5],[.5,-.31],[.5,.31],[.32,.5],[-.32,.5],[-.5,.3],[-.5,-.3]];
 const vertices=[],indices=[];const lean=(rand()-.5)*.17;
 for(let j=0;j<5;j++){let t=j/4;const shrink=j===4?.8:j===0?.85:1;for(let k=0;k<8;k++){
 const [x,z]=shape[k];vertices.push(x*w*shrink+(rand()-.5)*w*.12+lean*t,t*h+(j===4?(rand()-.5)*h*.055:0),z*d*shrink+(rand()-.5)*d*.07);
 }}
 for(let j=0;j<4;j++)for(let k=0;k<8;k++){const a=j*8+k,b=j*8+(k+1)%8,c=b+8,d=a+8;indices.push(a,b,d,b,c,d);}
 for(let k=1;k<7;k++){indices.push(0,k+1,k);indices.push(32,32+k,33+k);}
 for(let i=0;i<indices.length;i+=3){const t=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=t;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
const monument=new THREE.Group();scene.add(monument);
function stone(x,z,w,h,d,rotation=0,fallen=false){
 const g=outlined(stoneGeometry(w,h,d),monument,[x,0,z]);g.rotation.y=rotation;g.children[0].material=stonePaper;
 const edges=new THREE.LineSegments(new THREE.EdgesGeometry(g.children[0].geometry,55),new THREE.LineBasicMaterial({color:INK,transparent:true,opacity:.22}));g.add(edges);
 if(fallen){g.rotation.z=Math.PI/2-.08;g.updateMatrixWorld(true);g.position.y-=new THREE.Box3().setFromObject(g.children[0]).min.y;}
 // A few wavering vertical fissures make the broad faces feel hand drawn.
 for(let i=0;i<3;i++){const px=(rand()-.5)*w*.6, start=.1+rand()*.45, len=.16+rand()*.26;const pts=[];
 for(let j=0;j<12;j++)pts.push([px+Math.sin(j*.58+i)*.011+Math.sin(j*.21+i)*.007,h*(start+len*j/12),d*.51]);stroke(pts,g,.3);}
 return g;
}
// Each lintel bears on its own two uprights, rather than a fixed height.
function seatLintel(lintel,left,right){
 left.updateMatrixWorld(true);right.updateMatrixWorld(true);
 const h1=new THREE.Box3().setFromObject(left.children[0]).max.y;
 const h2=new THREE.Box3().setFromObject(right.children[0]).max.y;
 const dx=right.position.x-left.position.x,dz=right.position.z-left.position.z;
 lintel.rotation.order='YXZ';
 lintel.rotation.y=Math.atan2(-dz,dx);
 lintel.rotation.z=Math.atan2(h2-h1,Math.hypot(dx,dz));
 lintel.position.y=(h1+h2)/2-.025;
}
const slots=[];
for(let i=0;i<26;i++){const a=i/26*Math.PI*2;slots.push({x:Math.sin(a)*11,z:Math.cos(a)*10,a});}
// The near arc is ruined and open; the rear arc retains several lintels.
const supports=new Map();
const missing=new Set([0,1,2,3,8,12,19,23,24,25]);
for(let i=0;i<26;i++){if(missing.has(i))continue;let s=slots[i];supports.set(i,stone(s.x,s.z,1.6+rand()*.4,3.3+rand()*.8,1.1+rand()*.25,s.a));}
for(const i of [5,6,10,14,15,16,20]){if(missing.has(i)||missing.has(i+1))continue;const a=slots[i],b=slots[i+1];const g=stone((a.x+b.x)/2,(a.z+b.z)/2,2.75,.67,1.35,(a.a+b.a)/2);seatLintel(g,supports.get(i),supports.get(i+1));}
for(const a of [-2.25,-1.2,0,1.2,2.25]){const x=Math.sin(a)*5.1,z=-Math.cos(a)*5.1;const angle=-a;const pair=[];
 for(const side of [-1,1]){const dx=Math.cos(angle)*side*1.03,dz=-Math.sin(angle)*side*1.03;pair.push(stone(x+dx,z+dz,1.7,4.8+rand()*.35,1.25,angle));}
 const top=stone(x,z,4,.78,1.55,angle);seatLintel(top,pair[0],pair[1]);}
for(let i=0;i<13;i++){const a=i/13*Math.PI*2;if(i===0||i===4)continue;stone(Math.sin(a)*7.6,Math.cos(a)*6.9,.65+rand()*.3,1.1+rand()*.9,.65,a);}
for(const [x,z,w,h,d,r] of [[-6,8,1.2,3,.9,.6],[1,7,1.7,3,1.15,-.7],[3,9,1,1.9,.8,.2],[-12,2,1,2,.8,1.7],[-3,11,.7,1.6,.65,.8],[8,10,.8,1.3,.8,1]])stone(x,z,w,h,d,r,true);
const selectable=[];
function object(slug,label,x,y,z){const group=new THREE.Group();group.position.set(x,y,z);group.userData={slug,label};monument.add(group);selectable.push(group);return group;}
const ball=object('baseball','Baseball',-10.8,1.03,7.8);
outlined(new THREE.SphereGeometry(1.03,40,28),ball);
for(const side of [-1,1]){let pts=[];for(let i=0;i<=100;i++){const t=i/100*Math.PI*2;const a=side*(.65+.24*Math.cos(t*2));const r=Math.sqrt(1.045**2-a*a);pts.push([a,Math.sin(t)*r,Math.cos(t)*r]);}stroke(pts,ball);
 for(let i=0;i<42;i++){const t=i/42*Math.PI*2,a=side*(.65+.24*Math.cos(t*2)),r=Math.sqrt(1.05**2-a*a);stroke([[a-.05,Math.sin(t-.018)*r,Math.cos(t-.018)*r],[a+.05,Math.sin(t+.018)*r,Math.cos(t+.018)*r]],ball,.9);}}
const melon=object('watermelon','Watermelon',5.9,.95,8.7);melon.rotation.y=-.35;
outlined(new THREE.SphereGeometry(1,48,32),melon,[0,0,0],[1.6,.94,1]);
for(let k=0;k<10;k++){const pts=[];for(let i=1;i<90;i++){const t=i/90*Math.PI,a=k/10*Math.PI*2+Math.sin(t*11+k)*.018;pts.push([1.616*Math.cos(t),.956*Math.sin(t)*Math.cos(a),1.016*Math.sin(t)*Math.sin(a)]);}stroke(pts,melon,.9);}
const cat=object('caterpillar','You misunderstand me',9.3,.4212,6.8);cat.rotation.y=.5;cat.scale.set(1,.78,.78);
for(let i=0;i<9;i++){const x=(i-4)*.48,y=Math.sin(i*.5)*.13,z=Math.sin(i*.4)*.32,r=.5+Math.sin(i/8*Math.PI)*.12;
 outlined(new THREE.SphereGeometry(r,24,18),cat,[x,y,z],[.94,1,1]);
 for(const side of [-1,1]){const foot=outlined(new THREE.SphereGeometry(.12,10,8),cat,[x,-.4,z+side*.38],[1,.7,1.6]);}
}
for(const z of [-.21,.21]){stroke([[-2,.34,z],[-2.2,.77,z*1.9],[-2.39,.89,z*2.1]],cat);outlined(new THREE.SphereGeometry(.055,8,6),cat,[-2.39,.89,z*2.1]);}
for(const z of [-.28,.28]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.065,10,8),new THREE.MeshBasicMaterial({color:INK}));eye.position.set(-2.31,.13,z);cat.add(eye);}
// Sparse ink constellations sit behind and below the stones, with no horizon.
const stars=new THREE.Group();scene.add(stars);
for(let i=0;i<95;i++){const x=(rand()-.5)*105,y=(rand()-.5)*65,z=(rand()-.5)*100;if(Math.hypot(x,z)<16&&Math.abs(y)<10)continue;const size=.045+rand()*.09;stroke([[x-size,y,z],[x+size,y,z]],stars,.32);stroke([[x,y-size*1.5,z],[x,y+size*1.5,z]],stars,.32);}

// A hidden directional light casts shadows; the drawing materials stay intact.
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=false;
const sunlight=new THREE.DirectionalLight(0xffffff,1);sunlight.castShadow=true;
sunlight.shadow.mapSize.set(2048,2048);
Object.assign(sunlight.shadow.camera,{left:-70,right:70,top:70,bottom:-70,near:.5,far:350});
sunlight.shadow.bias=-.00015;sunlight.shadow.normalBias=.035;
scene.add(sunlight);scene.add(sunlight.target);
monument.traverse(mesh=>{if(mesh.isMesh&&(mesh.material===paper||mesh.material===stonePaper))mesh.castShadow=true;});
const shadowMaterial=new THREE.ShadowMaterial({color:INK,opacity:.09,depthWrite:false});
const shadowFloor=new THREE.Mesh(new THREE.PlaneGeometry(400,400),shadowMaterial);
shadowFloor.rotation.x=-Math.PI/2;shadowFloor.position.y=.005;shadowFloor.receiveShadow=true;scene.add(shadowFloor);
let solarLocation=SAN_FRANCISCO,solarSource='San Francisco',lastShadowUpdate=-Infinity;
function updateSunShadows(now){
 if(now-lastShadowUpdate<15000)return;lastShadowUpdate=now;
 const p=solarPosition(new Date(),solarLocation.latitude,solarLocation.longitude);
 const daylight=THREE.MathUtils.smoothstep(p.y,0,.12);
 sunlight.position.set(p.x,p.y,p.z).multiplyScalar(180);
 shadowMaterial.opacity=daylight*.09;shadowFloor.visible=daylight>0;
 renderer.shadowMap.needsUpdate=daylight>0;
 mount.dataset.sunSource=solarSource;mount.dataset.sunAltitude=(p.altitude*180/Math.PI).toFixed(2);
}
permittedLocation().then(location=>{if(location){solarLocation=location;solarSource='viewer';lastShadowUpdate=-Infinity;}});

let theta=.32,phi=.81,distance=40,targetTheta=theta,targetPhi=phi,targetDistance=distance;
const look=new THREE.Vector3(0,1.3,0),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function resize(){const w=mount.clientWidth,h=mount.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();
function home(){targetTheta=.32;targetPhi=.81;targetDistance=Math.max(40,Math.min(95,14.5/(Math.tan(39*Math.PI/360)*camera.aspect)));}
home();distance=targetDistance;
const pointers=new Map();let moved=false,start=null,lastPinch=0,clickTimer=null;
canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});start={x:e.clientX,y:e.clientY};moved=false;lastPinch=0;tooltip.hidden=true;});
canvas.addEventListener('pointermove',e=>{const prev=pointers.get(e.pointerId);if(!prev){hover(e);return;}const dx=e.clientX-prev.x,dy=e.clientY-prev.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>5){moved=true;clearTimeout(clickTimer);}
 if(pointers.size===2){moved=true;const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(lastPinch)targetDistance=Math.max(7,Math.min(95,targetDistance*lastPinch/d));lastPinch=d;}else{targetTheta-=dx*.006;targetPhi=Math.max(.08,Math.min(Math.PI/2,targetPhi-dy*.005));}});
canvas.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);lastPinch=0;if(!moved&&start){const hit=pick(e);if(hit){clearTimeout(clickTimer);clickTimer=setTimeout(()=>{requestReading(hit.userData.slug);clickTimer=null;},320);}}start=pointers.size?[...pointers.values()][0]:null;});
canvas.addEventListener('dblclick',e=>{e.preventDefault();clearTimeout(clickTimer);clickTimer=null;targetDistance=Math.max(7,targetDistance*.65);tooltip.hidden=true;});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);moved=true;lastPinch=0;});
canvas.addEventListener('wheel',e=>{e.preventDefault();targetDistance=Math.max(7,Math.min(95,targetDistance*Math.exp(Math.max(-100,Math.min(100,e.deltaY))*.0015)));},{passive:false});
canvas.addEventListener('keydown',e=>{const k=e.key;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(k))return;e.preventDefault();if(k==='ArrowLeft')targetTheta-=.13;if(k==='ArrowRight')targetTheta+=.13;if(k==='ArrowUp')targetPhi-=.1;if(k==='ArrowDown')targetPhi+=.1;if(k==='+'||k==='=')targetDistance*=.9;if(k==='-')targetDistance*=1.1;if(k==='Home')home();targetPhi=Math.max(.08,Math.min(Math.PI/2,targetPhi));targetDistance=Math.max(7,Math.min(95,targetDistance));});
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),tooltip=document.querySelector('#world-tooltip');
function pick(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(monument.children,true);if(!hits.length)return null;let node=hits[0].object;while(node&&node!==monument){if(node.userData.slug)return node;node=node.parent;}return null;}
function hover(e){const obj=pick(e);canvas.style.cursor=obj?'pointer':'grab';tooltip.hidden=!obj;if(obj){tooltip.textContent=obj.userData.label+' ↗';tooltip.style.left=Math.min(innerWidth-190,e.clientX+16)+'px';tooltip.style.top=Math.max(12,e.clientY-36)+'px';}}
canvas.addEventListener('pointerleave',()=>{tooltip.hidden=true;});
const dialog=document.querySelector('#reading');let returnFocus=null,preparedFrame=null;
const askPassword=createObjectPasswordPrompt({prepare:prepareReading});
async function requestReading(slug){
 tooltip.hidden=true;const trigger=document.activeElement;
 if(await askPassword(slug)){
  returnFocus=trigger;
  dialog.removeAttribute('data-preloading');dialog.removeAttribute('aria-hidden');dialog.inert=false;
  dialog.showModal();
 }
}
function prepareReading(slug,signal){
 const labels={watermelon:'Watermelon',baseball:'Baseball',caterpillar:'You misunderstand me'};
 dialog.querySelector('iframe')?.remove();
 const frame=document.createElement('iframe');preparedFrame=frame;
 frame.title=labels[slug]+' — interactive rambling';dialog.setAttribute('aria-label',labels[slug]);
 dialog.dataset.preloading='true';dialog.setAttribute('aria-hidden','true');dialog.inert=true;
 const url=new URL('ramblings-content.html',location.href);url.searchParams.set('object',slug);url.searchParams.set('embedded','1');frame.src=url.href;
 return new Promise((resolve,reject)=>{
  let raf=0,settled=false;
  const timeout=setTimeout(()=>finish(new Error('Artwork timed out')),45000);
  const abort=()=>finish(new DOMException('Canceled','AbortError'));
  function finish(error){
   if(settled)return;settled=true;clearTimeout(timeout);cancelAnimationFrame(raf);signal.removeEventListener('abort',abort);
   if(error){
    frame.remove();
    if(preparedFrame===frame){preparedFrame=null;dialog.removeAttribute('data-preloading');dialog.removeAttribute('aria-hidden');dialog.inert=false;}
    reject(error);
   }else{
    // The artwork has rendered; retain this same iframe so revealing it never reloads it.
    try{frame.contentWindow.addEventListener('keydown',event=>{if(event.key==='Escape')dialog.close();});}catch{}
    resolve();
   }
  }
  function inspect(){
   if(signal.aborted){abort();return;}
   try{
    const doc=frame.contentDocument;
    const nested=doc?.querySelector('#caterpillar-frame');
    const artwork=nested&&!nested.hidden?nested.contentDocument:doc;
    const scene=artwork?.querySelector('#scene');
    const status=doc?.querySelector('#status');
    const fallback=artwork?.querySelector('#fallback');
    if((status?.textContent.trim()&&!['Opening…'].includes(status.textContent.trim()))||(fallback&&!fallback.hidden)){
     finish(new Error('Artwork failed to load'));return;
    }
    if(scene?.dataset.ready==='true'&&scene.querySelector('canvas')){finish();return;}
   }catch{/* document.open() can briefly replace the frame document. */}
   raf=requestAnimationFrame(inspect);
  }
  signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted){abort();return;}
  dialog.append(frame);raf=requestAnimationFrame(inspect);
 });
}
document.querySelectorAll('[data-read]').forEach(b=>b.addEventListener('click',()=>requestReading(b.dataset.read)));
document.querySelector('#close-reading').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{dialog.querySelector('iframe')?.remove();preparedFrame=null;returnFocus?.focus();});
document.querySelector('#reset-view').addEventListener('click',home);
document.querySelector('#loading').hidden=true;
let last=0;
function render(now){updateSunShadows(now);const dt=Math.min((now-last)/1000,.05);last=now;const ease=reduced?1:1-Math.exp(-dt*11);theta+=(targetTheta-theta)*ease;phi+=(targetPhi-phi)*ease;distance+=(targetDistance-distance)*ease;
 camera.position.set(look.x+distance*Math.sin(phi)*Math.sin(theta),look.y+distance*Math.cos(phi),look.z+distance*Math.sin(phi)*Math.cos(theta));camera.lookAt(look);
 renderer.render(scene,camera);}
renderer.setAnimationLoop(render);
document.addEventListener('visibilitychange',()=>{renderer.setAnimationLoop(document.hidden?null:render);});
