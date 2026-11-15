export function airfoilView(s){
 if(!s.geometry?.connectedPlate)return {scale:350,leadingX:84,originY:150};
 const ys=s.geometry.upper.map(p=>p.y),lo=Math.min(...ys),hi=Math.max(...ys),scale=Math.min(350,148/Math.max(hi-lo,1e-6));
 return {scale,leadingX:84,originY:140+(lo+hi)*scale/2};
}
