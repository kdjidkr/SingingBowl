export function stepEnergy(energy,dt,tangentSpeed=0,contact=false){
 const drive=contact?Math.min(tangentSpeed,3)*.55:0;
 const next=energy*Math.exp(-dt*.42)+drive*dt*(1-energy);
 return next<.0001?0:Math.min(1,next);
}
export function impactEnergy(energy,normalSpeed){return Math.min(1,energy+Math.min(normalSpeed,5)**2*.065)}

export function strikeResponse(speed){
 const velocity=Math.max(0,Number.isFinite(speed)?speed:0);
 const strength=velocity/(velocity+4);
 return {strength,peak:.65*strength**1.6};
}

// Ideal axisymmetric shell approximation, not measurements of the recorded bowl.
// Each angular mode has a degenerate cos/sin pair. Total modal energy is
// independent of azimuth; the directional receiver sees their projection.
export function modalResponse(speed, azimuth, height, listenerAzimuth){
 const impulse=Math.max(0,speed)/(Math.max(0,speed)+4);
 const h=Math.max(0,Math.min(1,height));
 return [
  {order:2,frequency:92.5,decay:15,weight:1,power:1},
  {order:3,frequency:263.7,decay:10,weight:.43,power:1.6},
  {order:4,frequency:491.5,decay:7,weight:.23,power:2.3},
  {order:5,frequency:782,decay:4,weight:.12,power:3.1},
 ].map(m=>{
  const spatial=h**m.power;
  const excitation=impulse*m.weight*spatial;
  const cos=excitation*Math.cos(m.order*azimuth);
  const sin=excitation*Math.sin(m.order*azimuth);
  const received=cos*Math.cos(m.order*listenerAzimuth)+sin*Math.sin(m.order*listenerAzimuth);
  return {...m,cos,sin,amplitude:received};
 });
}

export function automaticProfile(level){
 const i=Math.max(0,Math.min(4,Math.round(Number(level)||1)-1));
 return {speed:[.7,1.5,3,5,8][i],gain:[.12,.25,.45,.7,1][i],tail:1};
}
