export function stepEnergy(energy,dt){
 const next=energy*Math.exp(-dt*.42);
 return next<.0001?0:Math.min(1,next);
}
export function impactEnergy(energy,normalSpeed){return Math.min(1,energy+Math.min(normalSpeed,5)**2*.065)}

export function automaticProfile(level){
 const i=Math.max(0,Math.min(4,Math.round(Number(level)||1)-1));
 return {speed:[.7,1.5,3,5,8][i],gain:[.12,.25,.45,.7,1][i]};
}
