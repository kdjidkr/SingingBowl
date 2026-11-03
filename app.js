import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import {stepEnergy,impactEnergy,strikeResponse,modalResponse,automaticProfile} from './physics.mjs';
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
const profile=[[0,0],[.3,0],[.5,.015],[.69,.065],[.86,.15],[1.01,.27],[1.13,.42],[1.21,.59],[1.25,.77],[1.267,.94],[1.27,1.08],[1.237,1.08],[1.233,.95],[1.216,.78],[1.176,.61],[1.097,.45],[.98,.31],[.83,.2],[.66,.12],[.48,.07],[.28,.055],[0,.055]];
const profileCurve=new THREE.SplineCurve(profile.map(p=>new THREE.Vector2(...p)));
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
const pad=new THREE.Mesh(new THREE.CylinderGeometry(.52,.55,.06,64),new THREE.MeshStandardMaterial({color:'#6a5b48',roughness:1}));pad.position.y=-.035;pad.castShadow=true;scene.add(pad);
floor.position.y=-.07;
const mallet=new THREE.Group();scene.add(mallet);
const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.115,.12,1.2,40),new THREE.MeshStandardMaterial({color:'#493020',roughness:.48}));shaft.position.y=.48;mallet.add(shaft);
const leather=new THREE.Mesh(new THREE.CylinderGeometry(.145,.145,.56,40),new THREE.MeshStandardMaterial({color:'#211d19',roughness:.9}));leather.position.y=-.1;mallet.add(leather);mallet.traverse(o=>{if(o.isMesh)o.castShadow=true});
// Blender sculpture, exported as a separate scene without lights or floor.
const kitten=new THREE.Group();mallet.add(kitten);
kitten.position.set(.04,.06,-.24);kitten.scale.setScalar(.43);kitten.rotation.z=-.45;
new GLTFLoader().load('./assets/cat-grip.glb',gltf=>{
 // Gently turn the feet outward while blending the deformation into the body.
 const sculpt=gltf.scene.getObjectByName('Cat sculpt.003');
 if(sculpt?.geometry){
  const geometry=sculpt.geometry.clone(),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
   const x=positions.getX(i),y=positions.getY(i)+.59,z=positions.getZ(i);
   const weight=THREE.MathUtils.smoothstep(Math.abs(x),.12,.29)*(1-THREE.MathUtils.smoothstep(y,.12,.38))*THREE.MathUtils.smoothstep(z,.05,.22);
   if(weight<=0)continue;
   const side=Math.sign(x),angle=side*.20*weight,pivotX=side*.34,pivotZ=.23;
   const dx=x-pivotX,dz=z-pivotZ,c=Math.cos(angle),sn=Math.sin(angle);
   positions.setX(i,pivotX+dx*c+dz*sn);positions.setZ(i,pivotZ-dx*sn+dz*c);
  }
  positions.needsUpdate=true;geometry.computeVertexNormals();sculpt.geometry=geometry;
 }
 kitten.add(gltf.scene);
 gltf.scene.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
},undefined,error=>{console.error('고양이 모델을 불러오지 못했습니다.',error)});
mallet.position.set(1.5,1.16,.15);mallet.rotation.z=-Math.PI/9;
let viewDrag=false,viewPointer=null,viewX=0,viewY=0,azimuth=0,elevation=.665;
// Account for the inward reach of the tilted leather cylinder, not just its origin.
const bowlOuterRadius=1.27;
const malletTilt=Math.PI/9;
const contactRadius=bowlOuterRadius+.38*Math.sin(malletTilt+.05)+.145*Math.cos(malletTilt+.05)+.015;
const restingRadius=contactRadius+.16;
mallet.position.set(restingRadius,1.16,.15);
const toolTarget=mallet.position.clone();
const grabOffset=new THREE.Vector2();
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

const bytes=fetch('./assets/bowl-fsharp2-trimmed.mp3').then(r=>{if(!r.ok)throw Error('음원 로딩 실패');return r.arrayBuffer()});bytes.catch(()=>hint.textContent='음원을 불러오지 못했습니다. 새로고침해 주세요.');
let ready;
function initAudio(){
 if(!ctx){ctx=new AudioContext();master=ctx.createGain();master.gain.value=muted?0:.65;const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-2;limiter.knee.value=3;limiter.ratio.value=4;toneFilter=ctx.createBiquadFilter();toneFilter.type='highpass';toneFilter.Q.value=.5;toneFilter.frequency.value=tone.cutoff;bodyFilter=ctx.createBiquadFilter();bodyFilter.type='peaking';bodyFilter.frequency.value=182*tone.rate;bodyFilter.Q.value=.75;bodyFilter.gain.value=0;master.connect(ctx.destination);
 ready=bytes.then(b=>ctx.decodeAudioData(b)).then(b=>{buffer=b;
 // Loop only the recorded resonance, crossfading the seam; never loop the strike.
 const rate=b.sampleRate,length=Math.floor(rate*4),fade=Math.floor(rate*.4),tail=ctx.createBuffer(b.numberOfChannels,length,rate);
 for(let c=0;c<b.numberOfChannels;c++){const src=b.getChannelData(c),out=tail.getChannelData(c),offset=Math.floor(rate*3);for(let i=0;i<length;i++){let v=src[offset+i];if(i>=length-fade){const t=(i-length+fade)/fade;v=v*(1-t)+src[offset+i-length]*t}out[i]=v}}
 loopSource=ctx.createBufferSource();loopSource.buffer=tail;loopSource.loop=true;loopSource.playbackRate.value=tone.rate;loopSource.loopStart=.4;loopGain=ctx.createGain();loopGain.gain.value=0;loopSource.connect(loopGain);loopGain.connect(master);loopSource.start();
 });ready.catch(()=>hint.textContent='음원을 재생할 수 없습니다. 새로고침해 주세요.');}
 ctx.resume();return ready;
}
let catCount=0;
function addCatMark(){
 const container=document.querySelector('#cat-marks');
 catCount++;
 const mark=document.createElement('span');mark.className=catCount%5===0?'cat-mark gold':'cat-mark';
 mark.innerHTML='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="M5.3 14.1 5.7 6l6.1 3.1a15 15 0 0 1 8.4 0L26.3 6l.4 8.1c1 1.8 1.1 4 .4 5.9-1.3 3.6-5.2 5.7-11.1 5.7S6.2 23.6 4.9 20c-.7-1.9-.6-4.1.4-5.9Z"/><path d="M11.2 16.1h.1m9.4 0h.1M14.2 19.1l1.8 1.2 1.8-1.2M16 20.3v1.2m-7.7-2.1-2.8-.5m17.9.5 2.8-.5"/></svg>';
 container.appendChild(mark);
 // Keep the visible trail bounded to the available viewport.
 const capacity=Math.max(1,Math.floor(container.clientWidth/62)*Math.floor(container.clientHeight/62));
 while(container.children.length>capacity)container.firstElementChild.remove();
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
 // The playback file already has its inaudible tail removed and a short end fade.
 src.start();addCatMark();
 const voice={src,g};active.add(voice);
 src.onended=()=>{active.delete(voice);src.disconnect();g.disconnect();queueAutoplay();};
}

const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-1.08);
function point(e){const rect=root.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const p=new THREE.Vector3();return ray.ray.intersectPlane(plane,p)}
let bowlTap=null;
root.addEventListener('pointerdown',e=>{
 if(e.button!==0||!e.isPrimary){bowlTap=null;return;}
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
 const ticket=requestId;
 try{
  const readyAudio=initAudio();await readyAudio;
  if(ticket!==requestId)return;
  clearTimeout(repeatTimer);repeatTimer=null;
  const profile=automaticProfile(Number(document.querySelector('#strength-slider').value)+2);
  strike(profile.speed,profile);energy=impactEnergy(energy,profile.speed);recoil=.005+.02*profile.gain;
  const direction=new THREE.Vector2(mallet.position.x,mallet.position.z).normalize();
  // Sound fires on touch; the shared animation must not fire it a second time.
  autoHit={start:performance.now()-.22*1000,direction,struck:true,from:Math.hypot(mallet.position.x,mallet.position.z),profile};
 }catch(error){hint.textContent='음원을 불러오지 못했습니다. 다시 눌러주세요.';}
},true);
root.addEventListener('pointerdown',e=>{
 if(drag||viewDrag||autoHit||e.button!==0)return;
 point(e); // Update the picking ray from the pointer position.
 const hit=ray.intersectObject(mallet,true).length>0;
 root.setPointerCapture(e.pointerId);root.classList.add('dragging');
 if(hit&&playMode==='direct'){initAudio();drag=true;lastPoint=point(e);if(lastPoint)grabOffset.set(mallet.position.x-lastPoint.x,mallet.position.z-lastPoint.z);lastTime=performance.now();contact=false;hint.style.opacity='0';}
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
function stop(){cancelRepeat();requestId++;autoPending=false;autoHit=null;energy=0;frictionEnergy=0;if(ctx){loopGain?.gain.setTargetAtTime(0,ctx.currentTime,.03);for(const v of active){v.g.gain.setTargetAtTime(0,ctx.currentTime,.025);v.src.stop(ctx.currentTime+.2)}active.clear()}}

function cancelRepeat(){repeating=false;clearTimeout(repeatTimer);repeatTimer=null;document.querySelector('#autoplay').checked=false;}
function queueAutoplay(){
 if(!repeating||active.size||autoHit||autoPending)return;
 clearTimeout(repeatTimer);
 repeatTimer=setTimeout(()=>{repeatTimer=null;if(repeating&&!active.size&&!autoHit&&!autoPending)triggerHit();},5000);
}
document.querySelector('#autoplay').onchange=e=>{
 repeating=e.currentTarget.checked;clearTimeout(repeatTimer);repeatTimer=null;
 if(repeating&&!active.size&&!autoHit&&!autoPending)triggerHit();
};
async function triggerHit(){
 if(autoHit||autoPending||playMode!=='auto')return;
 const ticket=requestId;autoPending=true;
 try{
  await initAudio();
  if(ticket!==requestId||playMode!=='auto')return;
  release();
  const direction=new THREE.Vector2(mallet.position.x,mallet.position.z).normalize();
  autoHit={start:performance.now(),direction,struck:false,from:Math.hypot(mallet.position.x,mallet.position.z),profile:automaticProfile(Number(document.querySelector('#strength-slider').value)+2)};
 }catch(error){cancelRepeat();hint.style.opacity='1';hint.textContent='음원을 불러오지 못했습니다. 다시 눌러주세요.';}
 finally{if(ticket===requestId){autoPending=false;queueAutoplay();}}
}
const playButton=document.querySelector('#play-once');
playButton.onclick=()=>{if(repeating||autoPending||autoHit||active.size>0)stop();else triggerHit()};
function updatePlayButton(){
 const playing=repeating||autoPending||!!autoHit||active.size>0;
 const label=playing?'멈추기':'울리기';
 if(playButton.textContent!==label)playButton.textContent=label;
 const state=String(playing);
 if(playButton.getAttribute('aria-pressed')!==state)playButton.setAttribute('aria-pressed',state);
}

document.querySelector('#mute').onclick=e=>{muted=!muted;const button=e.currentTarget;button.dataset.muted=String(muted);button.setAttribute('aria-label',muted?'소리 켜기':'소리 끄기');button.title=muted?'소리 켜기':'소리 끄기';if(master)master.gain.setTargetAtTime(muted?0:.65,ctx.currentTime,.03)};
window.addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden){release();stop()}});
function updateCamera(){
 const baseDistance=innerWidth/innerHeight<1.2?8.3:7.5;
 const mobile=matchMedia('(max-width: 600px), (pointer: coarse) and (max-height: 600px)').matches;
 // Fit both bowl and mallet by horizontal field of view on narrow screens.
 const horizontalFit=4.8/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect);
 const distance=mobile?Math.max(baseDistance*1.45,horizontalFit):baseDistance;
 const horizontal=Math.cos(elevation)*distance;
 camera.position.set(Math.sin(azimuth)*horizontal,.5+Math.sin(elevation)*distance,Math.cos(azimuth)*horizontal);
 camera.lookAt(0,.5,0);
}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;updateCamera();camera.updateProjectionMatrix()}
addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);resize();

let prev=performance.now();function frame(now){requestAnimationFrame(frame);updatePlayButton();const dt=Math.min(.05,(now-prev)/1000);prev=now;
 if(autoHit){
  const elapsed=(now-autoHit.start)/1000;
  let radius;
  if(elapsed<.22){radius=THREE.MathUtils.lerp(autoHit.from,1.85,elapsed/.22);}
  else if(elapsed<.36){radius=THREE.MathUtils.lerp(1.85,contactRadius,(elapsed-.22)/.14);}
  else{
   if(!autoHit.struck){autoHit.struck=true;energy=impactEnergy(energy,autoHit.profile.speed);strike(autoHit.profile.speed,autoHit.profile);recoil=.005+.02*autoHit.profile.gain;}
   radius=THREE.MathUtils.lerp(contactRadius,restingRadius,Math.min(1,(elapsed-.36)/.2));
  }
  toolTarget.set(autoHit.direction.x*radius,1.15,autoHit.direction.y*radius);
  if(elapsed>.6){autoHit=null;queueAutoplay();}
 }
 recoil*=Math.exp(-dt*18);
 kitten.rotation.z=-.45+Math.sin(now*.004)*.015+recoil*.6;
 const radius=Math.hypot(toolTarget.x,toolTarget.z);
 const targetPosition=toolTarget.clone();
 if(radius>0)targetPosition.multiplyScalar(1+recoil/radius);
 targetPosition.y=.07+hitHeight*1.08;
 mallet.position.lerp(targetPosition,1-Math.exp(-dt*65));
 const actualRadius=Math.hypot(mallet.position.x,mallet.position.z);
 if(actualRadius<contactRadius){mallet.position.x*=contactRadius/actualRadius;mallet.position.z*=contactRadius/actualRadius;}
 const angle=Math.atan2(mallet.position.z,mallet.position.x);
 mallet.rotation.set(Math.sin(angle)*(Math.PI/9+recoil*2),0,-Math.cos(angle)*(Math.PI/9+recoil*2));
 energy=stepEnergy(energy,dt,tangent,drag&&contact&&now-lastMove<100);frictionEnergy=stepEnergy(frictionEnergy,dt,tangent,drag&&contact&&now-lastMove<100);if(loopGain)loopGain.gain.setTargetAtTime(physical||frictionEnergy<.002?0:frictionEnergy*.32,ctx.currentTime,.12);group.rotation.z=Math.sin(now*.06)*energy*.0015;document.querySelector('#energy').style.width=`${energy*100}%`;renderer.render(scene,camera)}requestAnimationFrame(frame);

const strengthSlider=document.querySelector('#strength-slider');
function updateStrength(){
 strengthSlider.style.setProperty('--fill',((Number(strengthSlider.value)-1)/2*100)+'%');
 const labels=['1단계','2단계','3단계'];
 strengthSlider.setAttribute('aria-valuetext',labels[Number(strengthSlider.value)-1]);
 for(const button of document.querySelectorAll('[data-strength]'))button.setAttribute('aria-pressed',String(button.dataset.strength===strengthSlider.value));
}
strengthSlider.addEventListener('input',updateStrength);
for(const button of document.querySelectorAll('[data-strength]'))button.onclick=()=>{strengthSlider.value=button.dataset.strength;updateStrength()};

updateStrength();
