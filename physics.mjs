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
