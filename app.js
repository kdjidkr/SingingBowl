import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import {stepEnergy,impactEnergy,strikeResponse,modalResponse,automaticProfile} from './physics.mjs';
const mediumStrikeStrength=4;
const root=document.querySelector('#scene'),hint=document.querySelector('#hint');
const scene=new THREE.Scene();scene.background=new THREE.Color('#bdb2a0');scene.fog=new THREE.Fog('#bdb2a0',12,25);
const camera=new THREE.PerspectiveCamera(38,1,.1,40);camera.position.set(0,4.5,5.6);camera.lookAt(0,.5,0);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;root.appendChild(renderer.domElement);
// Broad studio reflections give the metal a real environment rather than a flat tint.
const studio=new THREE.Scene();studio.background=new THREE.Color('#8c8170');
for(const [x,y,z,w,h,color] of [[-4,3,2,3,7,'#fff5d8'],[4,4,-2,2,8,'#e1cfac'],[0,7,0,8,5,'#fff9e9'],[1,0,5,2,6,'#544636']]){const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));panel.position.set(x,y,z);panel.lookAt(0,1,0);studio.add(panel)}
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(studio,.06).texture;pmrem.dispose();
scene.add(new THREE.HemisphereLight('#fff6df','#615345',2));
const sun=new THREE.DirectionalLight('#fff2d5',3.2);sun.position.set(-3,7,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0003;scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#b9ac96',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.23;floor.receiveShadow=true;scene.add(floor);
const group=new THREE.Group();scene.add(group);
// Rounded lower body and nearly vertical upper walls, following the reference.
const profile=[[0,0],[.3,0],[.5,.015],[.69,.065],[.86,.15],[1.01,.27],[1.13,.42],[1.23,.59],[1.27,.77],[1.27,.94],[1.25,1.08],[1.217,1.08],[1.236,.95],[1.236,.78],[1.196,.61],[1.097,.45],[.98,.31],[.83,.2],[.66,.12],[.48,.07],[.28,.055],[0,.055]];
const bowlHeightScale=1.12;
const profileCurve=new THREE.SplineCurve(profile.map(([radius,height])=>new THREE.Vector2(radius,height*bowlHeightScale)));
const points=profileCurve.getPoints(240).map(p=>new THREE.Vector2(Math.max(0,p.x),p.y));
// Fine deterministic surface variation avoids mirror-polished tableware highlights.
const grainSize=128,grainBytes=new Uint8Array(grainSize*grainSize*4);let grainSeed=73;
for(let i=0;i<grainSize*grainSize;i++){grainSeed=(grainSeed*1664525+1013904223)>>>0;const value=145+(grainSeed%45);grainBytes.set([value,value,value,255],i*4)}
const grain=new THREE.DataTexture(grainBytes,grainSize,grainSize,THREE.RGBAFormat);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(8,3);grain.magFilter=THREE.LinearFilter;grain.needsUpdate=true;
const metal=new THREE.MeshStandardMaterial({color:'#b5a079',metalness:1,roughness:.33,envMapIntensity:1.65,bumpMap:grain,bumpScale:.0006});
// Two fine parallel engraved bands, without circular ornaments.
const bandCanvas=document.createElement('canvas');bandCanvas.width=512;bandCanvas.height=1024;
const bandInk=bandCanvas.getContext('2d');bandInk.fillStyle='#ffffff';bandInk.fillRect(0,0,512,1024);
const bandRelief=document.createElement('canvas');bandRelief.width=512;bandRelief.height=1024;
const bandCut=bandRelief.getContext('2d');bandCut.fillStyle='#b0b0b0';bandCut.fillRect(0,0,512,1024);
for(const [context,color] of [[bandInk,'#81796a'],[bandCut,'#575757']]){
 context.strokeStyle=color;context.lineWidth=2;
 for(const y of [574,586]){context.beginPath();context.moveTo(0,y);context.lineTo(512,y);context.stroke();}
}
metal.map=new THREE.CanvasTexture(bandCanvas);metal.map.colorSpace=THREE.SRGBColorSpace;
metal.bumpMap=new THREE.CanvasTexture(bandRelief);metal.bumpScale=.009;
metal.map.anisotropy=metal.bumpMap.anisotropy=renderer.capabilities.getMaxAnisotropy();
const bowl=new THREE.Mesh(new THREE.LatheGeometry(points,160),metal);bowl.castShadow=true;bowl.receiveShadow=true;group.add(bowl);
// The continuous wall profile supplies a thin lip, without an ornamental rim.
// Close the hollow bowl only for the shadow pass, preventing light leaking through its underside.
const shadowSealMaterial=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,side:THREE.DoubleSide});
const shadowSeal=new THREE.Mesh(new THREE.CircleGeometry(1.2,96),shadowSealMaterial);
shadowSeal.rotation.x=-Math.PI/2;shadowSeal.position.y=.82*bowlHeightScale;shadowSeal.castShadow=true;group.add(shadowSeal);
// A soft contact shadow anchors the bowl where its base meets the floor.
const contactCanvas=document.createElement('canvas');contactCanvas.width=256;contactCanvas.height=256;
const contactContext=contactCanvas.getContext('2d');
const contactGradient=contactContext.createRadialGradient(128,128,12,128,128,128);
contactGradient.addColorStop(0,'rgba(55,39,22,.48)');contactGradient.addColorStop(.48,'rgba(55,39,22,.27)');contactGradient.addColorStop(1,'rgba(55,39,22,0)');
contactContext.fillStyle=contactGradient;contactContext.fillRect(0,0,256,256);
const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(1.9,1.9),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(contactCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
contactShadow.rotation.x=-Math.PI/2;contactShadow.position.y=.003;scene.add(contactShadow);
floor.position.y=0;
const mallet=new THREE.Group();scene.add(mallet);
const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.115,.12,1.2,40),new THREE.MeshStandardMaterial({color:'#493020',roughness:.48}));shaft.position.y=.48;mallet.add(shaft);
const leather=new THREE.Mesh(new THREE.CylinderGeometry(.145,.145,.56,40),new THREE.MeshStandardMaterial({color:'#211d19',roughness:.9}));leather.position.y=-.1;mallet.add(leather);mallet.traverse(o=>{if(o.isMesh)o.castShadow=true});
// Sample the same wall profile used to render the bowl.
const wallTop=1.08*bowlHeightScale;
const wallRadii=Array.from({length:257},(_,index)=>{
 const y=index*wallTop/256;
 let radius=0;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  if(y<Math.min(a.y,b.y)||y>Math.max(a.y,b.y))continue;
  radius=Math.max(radius,a.y===b.y?Math.max(a.x,b.x):THREE.MathUtils.lerp(a.x,b.x,(y-a.y)/(b.y-a.y)));
 }
 return radius;
});
// Hide only the part of the mallet inside the bowl's outer surface.
const wallTexture=new THREE.DataTexture(new Float32Array(wallRadii),257,1,THREE.RedFormat,THREE.FloatType);
wallTexture.needsUpdate=true;
function maskMalletInsideBowl(material){
 material.onBeforeCompile=shader=>{
  shader.uniforms.bowlWall={value:wallTexture};
  shader.uniforms.bowlTop={value:wallTop};
  shader.vertexShader='varying vec3 malletWorld;\n'+shader.vertexShader.replace(
   '#include <project_vertex>',
   '#include <project_vertex>\nmalletWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader='varying vec3 malletWorld;\nuniform sampler2D bowlWall;\nuniform float bowlTop;\n'+
   shader.fragmentShader.replace('void main() {',`void main() {
    if(malletWorld.y>=0.0 && malletWorld.y<=bowlTop){
     float row=clamp(malletWorld.y/bowlTop,0.0,1.0)*256.0;
     float lower=floor(row);
     float wall=mix(texture2D(bowlWall,vec2((lower+0.5)/257.0,0.5)).r,
      texture2D(bowlWall,vec2((min(lower+1.0,256.0)+0.5)/257.0,0.5)).r,fract(row));
     if(length(malletWorld.xz)<wall) discard;
    }`);
 };
}
for(const part of [shaft,leather]){
 maskMalletInsideBowl(part.material);
 part.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
 maskMalletInsideBowl(part.customDepthMaterial);
}
// The cat stands on the floor independently of the mallet.
const kitten=new THREE.Group();scene.add(kitten);
const kittenScale=.50;
const catHoverBase=.88;
const upperMalletGrip=new THREE.Vector3(0,.49,0);
const restingPawCenter=new THREE.Vector3(-.44,.935,.80);
const gripWorld=new THREE.Vector3();
kitten.scale.setScalar(kittenScale);
kitten.rotation.y=-.72;
const grippingArms=[];
const wings=[];
const walkingFeet=[];
let catHead=null;
const headSetback=.25;

const footTarget=new THREE.Vector3();
const gripApproach=new THREE.Vector3();
const reduceFlightMotion=matchMedia('(prefers-reduced-motion: reduce)');
const flightShadow=contactShadow.clone();
flightShadow.material=contactShadow.material.clone();
flightShadow.scale.setScalar(.68);
scene.add(flightShadow);
const catLoader=new GLTFLoader();
Promise.all(['cat-complete-arms','paired-grip'].map(name=>catLoader.loadAsync('./assets/'+name+'.glb'))).then(([gltf,gripModel])=>{
 kitten.add(gltf.scene);
 const findPart=name=>gltf.scene.getObjectByName(name)||
  gltf.scene.children.find(object=>object.name.startsWith(name));
 const face=findPart('PeekFace');
 gltf.scene.traverse(object=>{
  const morph=object.morphTargetDictionary?.Peek;
  if(face&&morph!==undefined){
   const delta=object.geometry.morphAttributes.position[morph];
   // The authored lateral displacement ramps from zero at the neck to .20 at the head.
   for(let i=0;i<delta.count;i++){
    const headWeight=THREE.MathUtils.clamp(delta.getX(i)/.20,0,1);
    delta.setZ(i,delta.getZ(i)-headSetback*headWeight);
   }
   delta.needsUpdate=true;
   catHead={object,morph,face,rest:face.position.clone()};
  }
 });
 // Use the displayed mesh's skeleton; other exported scenes can reuse bone names.
 const walkingMesh=catHead?.object;
 if(walkingMesh?.isSkinnedMesh){
  const {json,associations}=gltf.parser;
  for(const name of ['Foot_R','Foot_L']){
   const foot=walkingMesh.skeleton.bones.find(bone=>{
    const nodeIndex=associations.get(bone)?.nodes;
    return json.nodes[nodeIndex]?.name===name || bone.name.startsWith(name);
   });
   if(foot)walkingFeet.push({foot,rest:foot.position.clone()});
  }
 }
 for(const [name,side] of [['Wing_L',-1],['Wing_R',1]]){
  const wing=findPart(name);
  if(wing)wings.push({wing,side});
 }
 // Sweep a rounded, continuous arm from inside the torso to each paw.
 for(const [side,x] of [['left',-.21],['right',.21]]){
  const original=gltf.scene.children.find(part=>part.userData.name?.startsWith(side+' gripping arm') || part.name.startsWith(side+'grippingarm'));
  const left=side==='left';
  const arm=gripModel.scene.getObjectByName(left?'GripLeft':'GripRight');
  if(!original || !arm)throw new Error('Missing '+side+' foreleg');
  original.visible=false;
  kitten.add(arm);
  arm.material=original.material;
  arm.castShadow=true;
  arm.receiveShadow=true;
  const geometry=arm.geometry;
  const position=geometry.attributes.position;
  const base=position.array.slice();
  const shoulder=new THREE.Vector3(x,.79,.08);
  const curve=new THREE.CubicBezierCurve3(shoulder,new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3());
  const center=new THREE.Vector3(), tangent=new THREE.Vector3();
  const cross=new THREE.Vector3(), normal=new THREE.Vector3();
  arm.geometry=geometry;
  arm.frustumCulled=false;
  grippingArms.push({position,base,geometry,curve,center,tangent,cross,normal,left});
 }
 gltf.scene.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
}).catch(error=>{console.error('고양이 모델을 불러오지 못했습니다.',error)});
mallet.rotation.z=-Math.PI/12;
let viewDrag=false,viewPointer=null,viewX=0,viewY=0,azimuth=0,elevation=.665-THREE.MathUtils.degToRad(13);
// Account for the inward reach of the tilted leather cylinder, not just its origin.
const bowlOuterRadius=1.25;
const malletTilt=Math.PI/12;
// At this playing height the inside edge of the leather sleeve meets the bowl wall.
const contactRadius=1.40;
const restingRadius=contactRadius+.16;
const malletDirection=new THREE.Vector2(1,.14).normalize();
mallet.position.set(restingRadius*malletDirection.x,.86,restingRadius*malletDirection.y);
// The model's paws sit in front and to the left of its feet.
const handOffset=restingPawCenter.clone().multiplyScalar(kittenScale).applyAxisAngle(new THREE.Vector3(0,1,0),kitten.rotation.y);
const restingGrip=mallet.localToWorld(upperMalletGrip.clone());
kitten.position.set(restingGrip.x-handOffset.x,catHoverBase,restingGrip.z-handOffset.z);
const toolTarget=mallet.position.clone();
const catHome=kitten.position.clone();
const catHomeYaw=kitten.rotation.y;
const orbitStartAngle=Math.atan2(malletDirection.y,malletDirection.x);
const orbitAxis=new THREE.Vector3(0,1,0);
const orbitMalletHeight=.73;
const orbitRadius=bowlOuterRadius+.116;
const walkStart=1.6;
const walkDuration=18;
let rimTurn=null;
const grabOffset=new THREE.Vector2();
// Keep the display awake only during an active listening session.
let screenLock=null,screenLockWanted=false,screenLockRequest=0;
async function keepScreenOn(){
 screenLockWanted=true;
 if(!navigator.wakeLock||screenLock||document.hidden)return;
 const request=++screenLockRequest;
 try{
  const lock=await navigator.wakeLock.request('screen');
  if(!screenLockWanted||request!==screenLockRequest||document.hidden){await lock.release();return;}
  screenLock=lock;lock.addEventListener('release',()=>{if(screenLock===lock)screenLock=null;},{once:true});
 }catch(error){console.info('화면 켜짐 유지가 지원되지 않거나 허용되지 않았습니다.',error.name);}
}
function releaseScreen(){
 screenLockWanted=false;screenLockRequest++;
 const lock=screenLock;screenLock=null;
 if(lock)lock.release().catch(()=>{});
}
let autoHit=null,playMode='auto',repeating=false,repeatTimer=null,requestId=0,autoPending=false;
let recoil=0;
let frictionEnergy=0;
let energy=0,drag=false,contact=false,lastPoint=null,lastTime=0,tangent=0,lastMove=0,muted=false,ctx,master,buffer,loopSource,loopGain,toneFilter,bodyFilter;
const active=new Set();
const tones={original:{rate:1,cutoff:20},clear:{rate:2**(3/12),cutoff:35},high:{rate:2**(7/12),cutoff:45}};
let tone=tones.original;
let physical=false,hitHeight=1;
function physicalStrike(speed,profile=null){
 const position=Math.atan2(mallet.position.x,mallet.position.z);
 const modes=modalResponse(speed,position,hitHeight,azimuth);
 const now=ctx.currentTime;
 for(const mode of modes){
  const src=ctx.createOscillator(),g=ctx.createGain();
  src.frequency.value=mode.frequency;
  const amplitude=mode.amplitude*.2;
  g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(amplitude,now+.006);
  g.gain.setTargetAtTime(0,now+.006,mode.decay*(profile?.tail??1)/3);
  src.connect(g);g.connect(master);src.start(now);src.stop(now+mode.decay*3);
  const voice={src,g};active.add(voice);
  src.onended=()=>{active.delete(voice);src.disconnect();g.disconnect();queueAutoplay();};
 }
}

function applyTone(){
 if(!ctx)return;
 toneFilter.frequency.setTargetAtTime(tone.cutoff,ctx.currentTime,.08);
 bodyFilter.frequency.setTargetAtTime(182*tone.rate,ctx.currentTime,.08);
 loopSource?.playbackRate.setTargetAtTime(tone.rate,ctx.currentTime,.08);
 for(const voice of active)voice.src.playbackRate?.setTargetAtTime(tone.rate,ctx.currentTime,.08);
}

let ready;
function resumeAudio(){
 if(ctx.state==='running')return Promise.resolve();
 let timer;
 const timeout=new Promise((_,reject)=>{
  timer=setTimeout(()=>reject(Error('Audio output is suspended')),3000);
 });
 return Promise.race([ctx.resume(),timeout]).then(()=>{
  if(ctx.state!=='running')throw Error('Audio output is suspended');
 }).finally(()=>clearTimeout(timer));
}
function recoverPlayback(){
 if(!ctx||ctx.state==='running'||!(rimTurn||repeating||autoHit||autoPending||active.size))return;
 resumeAudio().catch(()=>{hint.style.opacity='1';hint.textContent='소리를 다시 들으려면 화면을 한 번 눌러주세요.';});
}
function initAudio(){
 // Request media playback before creating or resuming Web Audio on iOS.
 try{
  if(navigator.audioSession && navigator.audioSession.type!=='playback'){
   navigator.audioSession.type='playback';
  }
 }catch{}
 if(!ctx){ctx=new AudioContext();master=ctx.createGain();master.gain.value=muted?0:Number(document.querySelector('#volume').value)/100;const outputBoost=ctx.createGain();outputBoost.gain.value=2.5;const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-4;limiter.knee.value=2;limiter.ratio.value=12;limiter.attack.value=.003;limiter.release.value=.25;toneFilter=ctx.createBiquadFilter();toneFilter.type='highpass';toneFilter.Q.value=.5;toneFilter.frequency.value=tone.cutoff;bodyFilter=ctx.createBiquadFilter();bodyFilter.type='peaking';bodyFilter.frequency.value=182*tone.rate;bodyFilter.Q.value=.75;bodyFilter.gain.value=0;master.connect(outputBoost);outputBoost.connect(limiter);limiter.connect(ctx.destination);
 }
 if(!ready)ready=fetch('./assets/bowl-fsharp2.mp3').then(response=>{
  if(!response.ok)throw Error('음원 로딩 실패');
  return response.arrayBuffer();
 }).then(bytes=>ctx.decodeAudioData(bytes)).then(b=>{buffer=b;
 // Loop only the recorded resonance, crossfading the seam; never loop the strike.
 const rate=b.sampleRate;
 const offset=Math.floor(rate*3);
 const fade=Math.floor(rate*.75);
 const reference=b.getChannelData(0);
 const nominalLength=Math.floor(rate*4);
 // Choose the overlap with the closest phase near the nominal loop end.
 let length=nominalLength;
 let bestMatch=-Infinity;
 let endGain=1;
 for(let shift=-Math.floor(rate*.025);shift<=Math.floor(rate*.025);shift++){
  const candidate=nominalLength+shift;
  let product=0,startPower=0,endPower=0;
  for(let i=0;i<fade;i+=64){
   const start=reference[offset+i];
   const end=reference[offset+candidate-fade+i];
   product+=start*end;
   startPower+=start*start;
   endPower+=end*end;
  }
  const match=product/Math.sqrt(startPower*endPower);
  if(match>bestMatch){
   bestMatch=match;
   length=candidate;
   // Match the overlap levels without excessively boosting the quieter tail.
   endGain=THREE.MathUtils.clamp(Math.sqrt(startPower/endPower),.71,1.41);
  }
 }
 const tail=ctx.createBuffer(b.numberOfChannels,length,rate);
 for(let c=0;c<b.numberOfChannels;c++){
  const src=b.getChannelData(c),out=tail.getChannelData(c);
  out.set(src.subarray(offset,offset+length));
  // Fade the level correction in before the two layers meet.
  const overlapStart=length-fade;
  for(let i=fade;i<length;i++){
   const progress=THREE.MathUtils.smoothstep(i,fade,overlapStart);
   out[i]*=THREE.MathUtils.lerp(1,endGain,progress);
  }
  for(let i=0;i<fade;i++){
   const index=overlapStart+i;
   const mix=.5-.5*Math.cos(Math.PI*i/fade);
   out[index]=out[index]*(1-mix)+src[offset+i]*mix;
  }
 }
 loopSource=ctx.createBufferSource();loopSource.buffer=tail;loopSource.loop=true;loopSource.playbackRate.value=tone.rate;loopSource.loopStart=fade/rate;loopGain=ctx.createGain();loopGain.gain.value=0;loopSource.connect(loopGain);loopGain.connect(master);loopSource.start();
 }).catch(error=>{ready=null;throw error;});
 return Promise.all([resumeAudio(),ready]);
}
function addCatMark(){
 const container=document.querySelector('#cat-marks');
 const cellSize=container.clientWidth/6;
 const rows=Math.max(1,Math.floor(container.clientHeight/cellSize));
 const capacity=rows*6;
 if(container.children.length>=capacity)container.replaceChildren();
 container.lastElementChild?.classList.remove('gold');
 const mark=document.createElement('span');mark.className='cat-mark gold';
 mark.innerHTML='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="M5.3 14.1 5.7 6l6.1 3.1a15 15 0 0 1 8.4 0L26.3 6l.4 8.1c1 1.8 1.1 4 .4 5.9-1.3 3.6-5.2 5.7-11.1 5.7S6.2 23.6 4.9 20c-.7-1.9-.6-4.1.4-5.9Z"/><path d="M11.2 16.1h.1m9.4 0h.1M14.2 19.1l1.8 1.2 1.8-1.2M16 20.3v1.2m-7.7-2.1-2.8-.5m17.9.5 2.8-.5"/></svg>';
 container.appendChild(mark);
}
function strike(speed,profile=null){
 if(!buffer)return;
 if(physical){addCatMark();physicalStrike(speed,profile);return;}
 const {peak}=strikeResponse(speed);
 // Strong automatic strike preserves the recording; manual hits only scale gain.
 const level=profile?profile.gain:Math.min(1,peak/.3398);
 if(level<.00001)return;
 const src=ctx.createBufferSource(),g=ctx.createGain();
 src.buffer=buffer;src.playbackRate.value=tone.rate;g.gain.value=level;
 src.connect(g);g.connect(master);
 // Preserve the recording's natural decay at every strength.
 // Play the full original file, including its natural tail.
 src.start();addCatMark();
 const voice={src,g};active.add(voice);
 src.onended=()=>{active.delete(voice);src.disconnect();g.disconnect();queueAutoplay();};
}

const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-1.08*bowlHeightScale);
function point(e){const rect=root.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const p=new THREE.Vector3();return ray.ray.intersectPlane(plane,p)}
let bowlTap=null;
root.addEventListener('pointerdown',e=>{
 if(rimTurn||e.button!==0||!e.isPrimary){bowlTap=null;return;}
 point(e);
 bowlTap=ray.intersectObject(bowl,false).length?{id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),moved:false}:null;
},true);
root.addEventListener('pointermove',e=>{
 if(bowlTap&&e.pointerId===bowlTap.id&&Math.hypot(e.clientX-bowlTap.x,e.clientY-bowlTap.y)>8)bowlTap.moved=true;
},true);
root.addEventListener('pointercancel',()=>bowlTap=null,true);
root.addEventListener('pointerup',async e=>{
 const tap=bowlTap;bowlTap=null;
 if(!tap||tap.id!==e.pointerId||tap.moved||performance.now()-tap.time>450)return;
 point(e);if(!ray.intersectObject(bowl,false).length)return;
 keepScreenOn();
 const ticket=requestId;
 try{
  const readyAudio=initAudio();await readyAudio;
  if(ticket!==requestId||rimTurn)return;
  clearTimeout(repeatTimer);repeatTimer=null;
  const profile=automaticProfile(mediumStrikeStrength);
  repeating=document.querySelector('#autoplay').checked;
  const direction=new THREE.Vector2(mallet.position.x,mallet.position.z).normalize();
  // A tap is an immediate hit: restart the short rebound on every tap.
  // Existing audio voices keep playing, even when taps arrive in quick succession.
  mallet.position.set(direction.x*contactRadius,.86,direction.y*contactRadius);
  toolTarget.set(direction.x*contactRadius,1.15,direction.y*contactRadius);
  strike(profile.speed,profile);energy=impactEnergy(energy,profile.speed);
  recoil=.005+.02*profile.gain;
  autoHit={start:performance.now()-1080,direction,struck:true,from:contactRadius,profile};
 }catch(error){releaseScreen();hint.textContent='재생을 시작하지 못했습니다. 다시 눌러주세요.';}
},true);
root.addEventListener('pointerdown',e=>{
 if(drag||viewDrag||autoHit||e.button!==0||!e.isPrimary)return;
 // During rim playback, every scene drag controls only the camera.
 let grabMallet=false;
 if(!rimTurn&&playMode==='direct'){
  point(e);
  grabMallet=ray.intersectObject(mallet,true).length>0;
 }
 root.setPointerCapture(e.pointerId);root.classList.add('dragging');
 if(grabMallet){initAudio().catch(()=>{release();hint.style.opacity='1';hint.textContent='재생을 시작하지 못했습니다. 다시 눌러주세요.';});drag=true;lastPoint=point(e);if(lastPoint)grabOffset.set(mallet.position.x-lastPoint.x,mallet.position.z-lastPoint.z);lastTime=performance.now();contact=false;hint.style.opacity='0';}
 else{viewDrag=true;viewPointer=e.pointerId;viewX=e.clientX;viewY=e.clientY;}
});
root.addEventListener('pointermove',e=>{
 if(viewDrag){if(e.pointerId!==viewPointer)return;if(bowlTap&&!bowlTap.moved)return;azimuth-=(e.clientX-viewX)*.006;elevation=THREE.MathUtils.clamp(elevation+(e.clientY-viewY)*.004,.18,1.35);viewX=e.clientX;viewY=e.clientY;updateCamera();return;}
 if(!drag)return;
 const p=point(e);if(!p||!lastPoint)return;
 const now=performance.now(),dt=Math.max(.008,(now-lastTime)/1000);
 const current=new THREE.Vector2(toolTarget.x,toolTarget.z);
 // Preserve the grab offset; project the pointer target onto the collision boundary.
 const target=new THREE.Vector2(p.x+grabOffset.x,p.z+grabOffset.y);
 const delta=target.clone().sub(current),boundary=contactRadius;
 // Swept circle collision catches a quick movement through the rim as well.
 const aa=delta.lengthSq(),bb=2*current.dot(delta),cc=current.lengthSq()-boundary*boundary;
 const disc=bb*bb-4*aa*cc;
 let hit=false;
 if(aa>1e-10&&disc>=0){const t=(-bb-Math.sqrt(disc))/(2*aa);hit=t>=0&&t<=1;}
 hit=hit||target.length()<boundary;
 const normal=(hit?current:target).clone().normalize();
 // Measure actual pointer motion, not the accumulated penetration offset.
 const motion=new THREE.Vector2(p.x-lastPoint.x,p.z-lastPoint.z);
 const inward=Math.max(0,-motion.dot(normal)/dt);
 if(hit){
   if(!contact&&inward>0){energy=impactEnergy(energy,inward);strike(inward);recoil=Math.min(.025,inward*.007);}
   // Remove penetration but retain tangential motion along the outside surface.
   if(target.length()>.35){target.normalize().multiplyScalar(boundary);}
   else{target.copy(current).normalize().multiplyScalar(boundary);}
 }
 const near=hit||target.length()<boundary+.045;
 tangent=near?Math.min(3,Math.abs(motion.x*normal.y-motion.y*normal.x)/dt):0;
 contact=near;
 if(target.length()>2.8)target.setLength(2.8);
 toolTarget.set(target.x,1.15,target.y);
 lastPoint=p;lastTime=now;lastMove=now;
});

function release(){viewDrag=false;viewPointer=null;drag=false;contact=false;tangent=0;lastPoint=null;root.classList.remove('dragging')}
for(const type of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(type,release);
function resetRimTurn(){
 rimTurn=null;
 kitten.position.copy(catHome);
 kitten.rotation.y=catHomeYaw;
 toolTarget.set(restingRadius*malletDirection.x,.86,restingRadius*malletDirection.y);
 mallet.position.copy(toolTarget);
}
function stop(){if(rimTurn)resetRimTurn();releaseScreen();cancelRepeat();requestId++;autoPending=false;autoHit=null;energy=0;frictionEnergy=0;if(ctx){loopGain?.gain.setTargetAtTime(0,ctx.currentTime,.03);for(const v of active){v.g.gain.setTargetAtTime(0,ctx.currentTime,.025);v.src.stop(ctx.currentTime+.2)}active.clear()}}

function cancelRepeat(){repeating=false;clearTimeout(repeatTimer);repeatTimer=null;document.querySelector('#autoplay').checked=false;}
function queueAutoplay(){
 if(rimTurn)return;
 if(!repeating&&!active.size&&!autoHit&&!autoPending)releaseScreen();
 if(!repeating||active.size||autoHit||autoPending)return;
 clearTimeout(repeatTimer);
 repeatTimer=setTimeout(()=>{repeatTimer=null;if(repeating&&!active.size&&!autoHit&&!autoPending)triggerHit();},0);
}
document.querySelector('#autoplay').onchange=e=>{
 repeating=e.currentTarget.checked;clearTimeout(repeatTimer);repeatTimer=null;
 if(!repeating&&!active.size&&!autoHit&&!autoPending)releaseScreen();
 if(repeating&&!active.size&&!autoHit&&!autoPending)triggerHit();
};
function finishHiddenHit(){
 if(!document.hidden||!autoHit)return;
 const {struck,profile}=autoHit;
 autoHit=null;
 if(!struck)strike(profile.speed,profile);
 queueAutoplay();
}
async function triggerHit(){
 if(rimTurn||autoHit||autoPending||playMode!=='auto')return;
 keepScreenOn();
 repeating=document.querySelector('#autoplay').checked;
 const ticket=requestId;autoPending=true;
 try{
  await initAudio();
  if(ticket!==requestId||playMode!=='auto')return;
  release();
  const direction=new THREE.Vector2(mallet.position.x,mallet.position.z).normalize();
  autoHit={start:performance.now(),direction,struck:false,from:Math.hypot(mallet.position.x,mallet.position.z),profile:automaticProfile(mediumStrikeStrength)};
  finishHiddenHit();
 }catch(error){releaseScreen();cancelRepeat();hint.style.opacity='1';hint.textContent='재생을 시작하지 못했습니다. 다시 눌러주세요.';}
 finally{if(ticket===requestId){autoPending=false;queueAutoplay();}}
}
const playButton=document.querySelector('#play-once');
const turnButton=document.querySelector('#rim-turn');
turnButton.onclick=async()=>{
 if(rimTurn){stop();return;}
 const autoplay=document.querySelector('#autoplay');
 const wasChecked=autoplay.checked;
 stop();
 autoplay.checked=wasChecked;
 release();
 const turn={start:null,touchedRim:false};
 rimTurn=turn;
 updatePlayButton();
 keepScreenOn();
 try{
  await initAudio();
  if(rimTurn===turn)turn.start=performance.now();
 }catch{
  if(rimTurn===turn){
   stop();
   hint.textContent='재생을 시작하지 못했습니다. 다시 눌러주세요.';
  }
 }
};
playButton.onclick=()=>{if(repeating||autoPending||autoHit||active.size>0)stop();else triggerHit()};
function updatePlayButton(){
 const turning=!!rimTurn;
 playButton.disabled=turning;
 const turnLabel=turning?'멈추기':'돌리기';
 if(turnButton.textContent!==turnLabel)turnButton.textContent=turnLabel;
 if(turnButton.getAttribute('aria-pressed')!==String(turning))turnButton.setAttribute('aria-pressed',String(turning));
 const playing=repeating||autoPending||!!autoHit||active.size>0;
 const label=playing?'멈추기':'울리기';
 if(playButton.textContent!==label)playButton.textContent=label;
 const state=String(playing);
 if(playButton.getAttribute('aria-pressed')!==state)playButton.setAttribute('aria-pressed',state);
}

let shareStatusTimer;
const shareStatus=document.querySelector('#share-status');
function showShareStatus(message){shareStatus.textContent=message;clearTimeout(shareStatusTimer);shareStatusTimer=setTimeout(()=>shareStatus.textContent='',3000)}
document.querySelector('#share').addEventListener('click',async()=>{
 const url=location.href;
 try{
  if(navigator.share){await navigator.share({title:document.title,url});return}
  if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
  await navigator.clipboard.writeText(url);showShareStatus('주소를 복사했어요');
 }catch(error){
  if(error.name==='AbortError')return;
  if(navigator.share&&navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(url);showShareStatus('주소를 복사했어요');return}catch{}}
  showShareStatus('주소창에서 주소를 복사해 주세요');
 }
});
document.querySelector('#mute').onclick=e=>{muted=!muted;const button=e.currentTarget;button.dataset.muted=String(muted);button.setAttribute('aria-label',muted?'소리 켜기':'소리 끄기');button.title=muted?'소리 켜기':'소리 끄기';if(master)master.gain.setTargetAtTime(muted?0:Number(document.querySelector('#volume').value)/100,ctx.currentTime,.03)};
document.querySelector('#volume').addEventListener('input',e=>{
 const value=Number(e.currentTarget.value)/100;
 if(master)master.gain.setTargetAtTime(muted?0:value,ctx.currentTime,.03);
});
document.addEventListener('pointerup',recoverPlayback,true);
window.addEventListener('pageshow',recoverPlayback);
window.addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden){release();finishHiddenHit()}else recoverPlayback()});
function updateCamera(){
 const baseDistance=innerWidth/innerHeight<1.2?8.3:7.5;
 const mobile=matchMedia('(max-width: 600px), (pointer: coarse) and (max-height: 600px)').matches;
 // Fit both bowl and mallet by horizontal field of view on narrow screens.
 const portrait=mobile&&camera.aspect<.8;
 const sceneWidth=portrait?5.35:6.6;
 const horizontalFit=sceneWidth/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect);
 const minimumDistance=mobile?baseDistance*1.45/1.2:baseDistance;
 const distance=Math.max(minimumDistance,horizontalFit);
 const horizontal=Math.cos(elevation)*distance;
 const targetY=mobile?.25:.5;
 camera.position.set(Math.sin(azimuth)*horizontal,targetY+Math.sin(elevation)*distance,Math.cos(azimuth)*horizontal);
 camera.lookAt(0,targetY,0);
 // Center the bowl between the upper volume control and the lower action.
 camera.clearViewOffset();
 camera.updateMatrixWorld();
 camera.updateProjectionMatrix();
 const upper=document.querySelector('.tools').getBoundingClientRect();
 const lower=document.querySelector('#play-once').getBoundingClientRect();
 const centerY=upper.bottom+(lower.top-upper.bottom)*(portrait?.54:.62);
 const bowlCenter=new THREE.Vector3(0,.45,0).project(camera);
 const currentY=(1-bowlCenter.y)*innerHeight/2;
 camera.setViewOffset(innerWidth,innerHeight,0,currentY-centerY,innerWidth,innerHeight);
}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;updateCamera();camera.updateProjectionMatrix()}
addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);resize();

let prev=performance.now();function frame(now){requestAnimationFrame(frame);updatePlayButton();const dt=Math.min(.05,(now-prev)/1000);prev=now;
 let impactProfile=null;
 let landed=0, folded=0, orbitAngle=0, rimSound=0, push=0, rimContact=0;
 if(rimTurn?.start!=null){
  const elapsed=(now-rimTurn.start)/1000;
  const walkTime=Math.max(0,elapsed-walkStart);
  const ramp=1;
  // Accelerate once, then continue around the rim at a steady pace.
  const startRamp=Math.max(0,ramp-walkTime);
  const travel=(walkTime-ramp/2+startRamp**2/(2*ramp))/walkDuration;
  orbitAngle=travel*Math.PI*2;
  landed=THREE.MathUtils.smoothstep(elapsed,0,1.15);
  folded=THREE.MathUtils.smoothstep(elapsed,.79,1.05);
  rimContact=THREE.MathUtils.smoothstep(elapsed,1.05,walkStart);
  const radius=THREE.MathUtils.lerp(restingRadius,orbitRadius,rimContact);
  const angle=orbitStartAngle+orbitAngle;
  toolTarget.set(radius*Math.cos(angle),.86,radius*Math.sin(angle));
  // Build resonance during the first lap, then sustain it.
  rimSound=THREE.MathUtils.lerp(.16,.22,Math.min(1,travel));
  kitten.position.copy(catHome).applyAxisAngle(orbitAxis,-orbitAngle);
  // Keep the torso aligned with the push while the head turns separately.
  push=rimContact*(.09+.025*Math.sin(orbitAngle*9));
  const behind=.53;
  const sideClearance=.32;
  // Face mostly along the tangent so the inward shoulder clears the rim.
  const walkingYaw=-angle-.25;
  const turnIntoWalk=THREE.MathUtils.smoothstep(elapsed,.12,walkStart);
  const orbitYaw=catHomeYaw-orbitAngle;
  kitten.rotation.y=THREE.MathUtils.lerp(orbitYaw,walkingYaw,turnIntoWalk);
  const outside=radius+sideClearance;
  kitten.position.x=THREE.MathUtils.lerp(kitten.position.x,outside*Math.cos(angle)+behind*Math.sin(angle),turnIntoWalk);
  kitten.position.z=THREE.MathUtils.lerp(kitten.position.z,outside*Math.sin(angle)-behind*Math.cos(angle),turnIntoWalk);
 }
 if(autoHit){
  const elapsed=(now-autoHit.start)/1000;
  let radius;
  if(elapsed<.68){const t=THREE.MathUtils.smoothstep(elapsed,0,.68);radius=THREE.MathUtils.lerp(autoHit.from,restingRadius+.17,t);}
  else if(elapsed<.98){const t=THREE.MathUtils.smoothstep(elapsed,.68,.98);radius=THREE.MathUtils.lerp(restingRadius+.17,contactRadius,t);}
  else{
   if(!autoHit.struck){autoHit.struck=true;impactProfile=autoHit.profile;}
   radius=THREE.MathUtils.lerp(contactRadius,restingRadius,THREE.MathUtils.smoothstep(elapsed,1.08,1.72));
  }
  toolTarget.set(autoHit.direction.x*radius,1.15,autoHit.direction.y*radius);
  if(elapsed>1.72){autoHit=null;queueAutoplay();}
 }
 recoil*=Math.exp(-dt*18);
 // Pivot at the feet: lean back under the mallet's weight, then follow through.
 const lean=THREE.MathUtils.clamp((restingRadius-Math.hypot(toolTarget.x,toolTarget.z))*1.3,-.22,.18);
 // The downstroke lifts the body, followed by a slower settling arc.
 const flightPhase=(now/1750)%1;
 const lift=flightPhase<.28
  ? THREE.MathUtils.smoothstep(flightPhase,0,.28)
  : 1-THREE.MathUtils.smoothstep(flightPhase,.28,1);
 const flightMoves=wings.length===2&&!reduceFlightMotion.matches;
 const hoverHeight=(catHoverBase+(flightMoves ? .055*lift : 0))*(1-landed);
 kitten.position.y=hoverHeight;
 const pressure=push*2;
 const stepPhase=orbitAngle*11;
 const stepLift=Math.abs(Math.sin(stepPhase))*rimContact;
 kitten.position.y+=.006*stepLift;
 kitten.rotation.order='YXZ';
 kitten.rotation.x=pressure;
 kitten.rotation.z=(-.21+lean+recoil*.5+(flightMoves ? .014*Math.sin(flightPhase*Math.PI*2) : 0))*(1-landed);
 for(const {wing,side} of wings){
  wing.rotation.z=side*THREE.MathUtils.lerp(flightMoves ? .03+.19*Math.cos(flightPhase*Math.PI*2) : .03,-1.12,folded);
  wing.visible=folded<.995;
  wing.scale.setScalar(1-folded*.98);
  wing.rotation.y=side*THREE.MathUtils.lerp(flightMoves ? .035*Math.sin(flightPhase*Math.PI*2) : 0,1.22,folded);
 }
 flightShadow.position.set(kitten.position.x,.004,kitten.position.z);
 flightShadow.material.opacity=.34-hoverHeight*.18;
 flightShadow.scale.setScalar(.68+hoverHeight*.7);
 const radius=Math.hypot(toolTarget.x,toolTarget.z);
 const targetPosition=toolTarget.clone();
 if(radius>0)targetPosition.multiplyScalar(1+recoil/radius);
 targetPosition.y=THREE.MathUtils.lerp(.86,orbitMalletHeight,landed);
 if(impactProfile){
  mallet.position.copy(targetPosition);
  energy=impactEnergy(energy,impactProfile.speed);strike(impactProfile.speed,impactProfile);
  recoil=.005+.02*impactProfile.gain;
 }else mallet.position.lerp(targetPosition,1-Math.exp(-dt*65));
 const actualRadius=Math.hypot(mallet.position.x,mallet.position.z);
 const minRadius=THREE.MathUtils.lerp(contactRadius,orbitRadius,rimContact);
 if(rimTurn?.start!=null&&rimContact===1&&actualRadius<=orbitRadius+.001){
  rimTurn.touchedRim=true;
 }
 if(actualRadius<minRadius){mallet.position.x*=minRadius/actualRadius;mallet.position.z*=minRadius/actualRadius;}
 const angle=Math.atan2(mallet.position.z,mallet.position.x);
 const tilt=THREE.MathUtils.lerp(malletTilt+recoil*2,0,landed);
 mallet.rotation.set(Math.sin(angle)*tilt,0,-Math.cos(angle)*tilt);
 // Keep both paws close to the moving shaft while the cat hovers.
 if(catHead){
  const peek=THREE.MathUtils.lerp(.08,.18,rimContact);
  catHead.object.morphTargetInfluences[catHead.morph]=peek;
  catHead.face.position.copy(catHead.rest);
  // Matches the Blender Peek shape key in glTF coordinates.
  catHead.face.position.x+=.20*peek;
  catHead.face.position.y+=.045*peek;
  catHead.face.position.z-=headSetback*peek;
 }
 kitten.updateMatrixWorld(true);
 // Each stance foot holds a fixed point on the ground for half a cycle.
 const cyclesPerLap=28;
 const cycleAngle=Math.PI*2/cyclesPerLap;
 const cycle=orbitAngle/cycleAngle;
 const stepBlend=rimContact*THREE.MathUtils.smoothstep(cycle,0,.5);
 walkingFeet.forEach(({foot,rest},index)=>{
  foot.position.copy(rest);
  if(stepBlend<=0)return;
  const phase=(cycle+index*.5)%1;
  const swing=THREE.MathUtils.smoothstep(phase,.5,1);
  const offset=(.25-phase+swing)*cycleAngle;
  footTarget.copy(rest).multiplyScalar(kittenScale).applyAxisAngle(orbitAxis,kitten.rotation.y);
  footTarget.x+=kitten.position.x;
  footTarget.z+=kitten.position.z;
  footTarget.applyAxisAngle(orbitAxis,-offset);
  footTarget.y=rest.y*kittenScale+(phase>.5?.052*Math.sin((phase-.5)*2*Math.PI):0);
  foot.position.lerp(foot.parent.worldToLocal(footTarget),stepBlend);
 });
 mallet.worldToLocal(gripApproach.copy(kitten.position));
 const approachAngle=Math.atan2(gripApproach.z,gripApproach.x);
 for(const {position,base,geometry,curve,center,tangent,cross,normal,left} of grippingArms){
  const gripHeight=THREE.MathUtils.lerp(upperMalletGrip.y,-.13,landed);
  const shaftRadius=gripHeight<=.18?.145:THREE.MathUtils.lerp(.12,.115,(gripHeight+.12)/1.2);
  // Seat the paw slightly into the surface so its rounded pads stay in contact.
  const pawRadius=shaftRadius+.022;
  const flightApproach=orbitAngle-Math.PI/2;
  const turn=Math.atan2(Math.sin(approachAngle-flightApproach),Math.cos(approachAngle-flightApproach));
  const gripAngle=flightApproach+turn*landed+(left?-1:1)*THREE.MathUtils.lerp(left?.48:2.48,1.08,landed);
  gripWorld.set(Math.cos(gripAngle)*pawRadius,gripHeight,Math.sin(gripAngle)*pawRadius);
  kitten.worldToLocal(mallet.localToWorld(gripWorld));
  const side=left?-1:1;
  if(left)curve.v0.z=THREE.MathUtils.lerp(-.04,.08,landed);
  curve.v1.copy(curve.v0);
  curve.v1.x+=side*THREE.MathUtils.lerp(left?.17:.38,.12,landed);
  curve.v1.y-=THREE.MathUtils.lerp(.24,.13,landed);
  curve.v1.z+=.18;
  curve.v2.copy(gripWorld);
  curve.v2.x+=side*THREE.MathUtils.lerp(.19,.08,landed);
  curve.v2.z-=THREE.MathUtils.lerp(.20,.26,landed);
  curve.v3.copy(gripWorld);
  // The wrist follows the shaft before the rounded paw turns onto its front.
  const wristAngle=gripAngle-side*.93;
  const wristRadius=pawRadius+.11;
  gripWorld.set(Math.cos(wristAngle)*wristRadius,gripHeight-.025,Math.sin(wristAngle)*wristRadius);
  kitten.worldToLocal(mallet.localToWorld(gripWorld));
  curve.v2.lerp(gripWorld,1-landed);
  for(let i=0;i<position.count;i++){
   const t=base[i*3+1];
   curve.getPoint(t,center);
   curve.getTangent(t,tangent);
   normal.set(0,1,0).addScaledVector(tangent,-tangent.y).normalize();
   cross.crossVectors(tangent,normal).normalize();
   center.addScaledVector(cross,base[i*3]);
   center.addScaledVector(normal,base[i*3+2]);
   position.setXYZ(i,center.x,center.y,center.z);
  }
  position.needsUpdate=true;
  geometry.computeVertexNormals();
 }
 energy=stepEnergy(energy,dt,tangent,drag&&contact&&now-lastMove<100);frictionEnergy=stepEnergy(frictionEnergy,dt,tangent,drag&&contact&&now-lastMove<100);if(loopGain)loopGain.gain.setTargetAtTime(rimTurn ? (rimTurn.touchedRim ? rimSound : 0) : (physical||frictionEnergy<.002 ? 0 : frictionEnergy*.32),ctx.currentTime,.12);group.rotation.z=Math.sin(now*.06)*energy*.0015;renderer.render(scene,camera)}requestAnimationFrame(frame);
