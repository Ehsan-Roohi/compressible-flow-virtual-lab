export const contourRamp = ['#1834b8','#007fff','#00c9e8','#20c75a','#e6e529','#ff961f','#db2525'];
const palette = contourRamp.map(color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)));

export function contourColor(value){
 const scaled=Math.min(1,Math.max(0,value))*(palette.length-1);
 const i=Math.min(palette.length-2,Math.floor(scaled)), f=scaled-i;
 return palette[i].map((channel,j)=>Math.round(channel+f*(palette[i+1][j]-channel)));
}

export function contourPixels(rows,width,height,pixels,leftFractions){
 const lastRow=rows.length-1,lastCol=rows[0].length-1;
 const columns=Array.from({length:width},(_,x)=>{
  const col=Math.min(lastCol,Math.max(0,(x+.5)/width*(lastCol+1)-.5));
  return [Math.floor(col),Math.min(lastCol,Math.floor(col)+1),col%1];
 });
 const colors=Array.from({length:2048},(_,i)=>contourColor(i/2047));
 for(let y=0,k=0;y<height;y++){
  // Image rows start at the top, while the x–t diagram starts at t = 0 at the bottom.
  const time=height===1?0:(1-y/(height-1))*lastRow;
  const lo=rows[Math.floor(time)],hi=rows[Math.min(lastRow,Math.floor(time)+1)],ft=time%1;
  const left=leftFractions?leftFractions[Math.floor(time)]*(1-ft)+leftFractions[Math.min(lastRow,Math.floor(time)+1)]*ft:0;
  for(let x=0;x<width;x++){
   let [i,j,fx]=columns[x];
   if(leftFractions){
    const fraction=(x+.5)/width;
    if(fraction<left){k+=4;continue;}
    const col=Math.min(lastCol,Math.max(0,(fraction-left)/(1-left)*(lastCol+1)-.5));
    i=Math.floor(col);j=Math.min(lastCol,i+1);fx=col%1;
   }
   const a=lo[i]+fx*(lo[j]-lo[i]),b=hi[i]+fx*(hi[j]-hi[i]);
   const rgb=colors[Math.round(2047*Math.max(0,Math.min(1,a+ft*(b-a))))];
   pixels[k++]=rgb[0];pixels[k++]=rgb[1];pixels[k++]=rgb[2];pixels[k++]=255;
  }
 }
}

const rasterURLs=new WeakMap();

export function contourRasterURL(map){
 if(rasterURLs.has(map))return rasterURLs.get(map);
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(1080,map.rows[0].length);
 canvas.height=440;
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 const image=ctx.createImageData(canvas.width,canvas.height);
 contourPixels(map.rows,canvas.width,canvas.height,image.data,map.leftFractions);
 ctx.putImageData(image,0,0);
 const url=canvas.toDataURL('image/png');
 rasterURLs.set(map,url);
 return url;
}
