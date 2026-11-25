// Dimensionless one-dimensional linear acoustic educational demonstration.
// Constant propagation speed; fixed smooth unit pulse, not a finite-pressure shock model.
export const stepsPerCrossing = 240;
export const totalSteps = 4 * stepsPerCrossing;
export function simulate(left = "closed", right = "open", pulse = "compression", direction = "right") {
  const n = stepsPerCrossing + 1;
  let a = new Float64Array(n), b = new Float64Array(n);
  const pressure = [], velocity = [];
  const sign = pulse === "expansion" ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const d = (i / stepsPerCrossing - .5) / .12;
    const q = Math.abs(d) < 1 ? sign * .5 * (1 + Math.cos(Math.PI * d)) : 0;
    (direction === "left" ? b : a)[i] = q;
  }
  const al = left === "open" ? -1 : 1;
  const ar = right === "open" ? -1 : 1;
  for (let t = 0; t <= totalSteps; t++) {
    pressure.push(Float32Array.from(a, (x, i) => x + b[i]));
    velocity.push(Float32Array.from(a, (x, i) => x - b[i]));
    const aa = new Float64Array(n), bb = new Float64Array(n);
    aa.set(a.subarray(0, n - 1), 1);
    bb.set(b.subarray(1), 0);
    aa[0] = al * bb[0];
    bb[n - 1] = ar * aa[n - 1];
    a = aa; b = bb;
  }
  return { pressure, velocity };
}
function color(v) {
  const n = Math.min(1, Math.abs(v) / 2);
  const end = v < 0 ? [33,102,172] : [178,24,43];
  return end.map(c => Math.round(249 * (1 - n) + c * n));
}
if (typeof document !== "undefined") {
  const $ = id => document.getElementById(id);
  const contour = $("contour"), profile = $("profile");
  const cc = contour.getContext("2d"), pc = profile.getContext("2d");
  const dims = { left: 70, right: 20, top: 17, bottom: 52 };
  let field, image, step = 0, playing = false, last = 0, accum = 0, frame = 0;
  const timeSlider = $("time");
  timeSlider.max = totalSteps; timeSlider.step = 1;
  function axes(ctx, canvas, yLabel, yTicks, xTicks) {
    const {left:l,right:r,top:t,bottom:b} = dims;
    const w = canvas.width-l-r, h = canvas.height-t-b;
    ctx.strokeStyle="#24474e";ctx.lineWidth=1.4;ctx.strokeRect(l,t,w,h);
    ctx.font="15px Georgia";ctx.fillStyle="#24474e";ctx.textAlign="center";
    for(const [v,label] of xTicks)ctx.fillText(label,l+w*v,canvas.height-30);
    ctx.fillText("x / L", l+w/2,canvas.height-8);
    ctx.textAlign="right";
    for(const [v,label] of yTicks)ctx.fillText(label,l-8,t+h*(1-v)+5);
    ctx.save();ctx.translate(16,t+h/2);ctx.rotate(-Math.PI/2);ctx.textAlign="center";ctx.fillText(yLabel,0,0);ctx.restore();
    return {l,t,w,h};
  }
  const xt = [[0,"0"],[.25,"0.25"],[.5,"0.5"],[.75,"0.75"],[1,"1"]];
  function rebuildRaster() {
    const samples = field[$("quantity").value], n = samples[0].length;
    const buffer = document.createElement("canvas");buffer.width=n;buffer.height=samples.length;
    const c=buffer.getContext("2d"), data=c.createImageData(n,samples.length);
    for(let y=0;y<samples.length;y++)for(let x=0;x<n;x++){
      const [r,g,b]=color(samples[samples.length-1-y][x]);
      const j=4*(y*n+x);data.data[j]=r;data.data[j+1]=g;data.data[j+2]=b;data.data[j+3]=255;
    }
    c.putImageData(data,0,0);image=buffer;
  }
  function draw() {
    cc.fillStyle="#fff";cc.fillRect(0,0,contour.width,contour.height);
    const {left:l,right:r,top:t,bottom:b}=dims;
    const w=contour.width-l-r,h=contour.height-t-b;
    cc.imageSmoothingEnabled=true;cc.drawImage(image,l,t,w,h);
    axes(cc,contour,"Normalized time",[[0,"0"],[.25,"1"],[.5,"2"],[.75,"3"],[1,"4"]],xt);
    const y=t+h*(1-step/totalSteps);
    cc.strokeStyle="#153b3e";cc.lineWidth=2;cc.setLineDash([6,5]);cc.beginPath();cc.moveTo(l,y);cc.lineTo(l+w,y);cc.stroke();cc.setLineDash([]);
    pc.fillStyle="#fff";pc.fillRect(0,0,profile.width,profile.height);
    // The instantaneous superposition at a closed or open wall can reach twice the pulse scale.
    const a=axes(pc,profile,"Relative perturbation",[[0,"−2"],[.25,"−1"],[.5,"0"],[.75,"1"],[1,"2"]],xt);
    pc.strokeStyle="#dce6e1";pc.beginPath();pc.moveTo(a.l,a.t+a.h/2);pc.lineTo(a.l+a.w,a.t+a.h/2);pc.stroke();
    for(const [key,stroke] of [["pressure","#087970"],["velocity","#d57561"]]){
      pc.strokeStyle=stroke;pc.lineWidth=2.8;pc.beginPath();
      field[key][step].forEach((v,i)=>{const x=a.l+a.w*i/stepsPerCrossing,y=a.t+a.h*(.5-v/4);if(i===0)pc.moveTo(x,y);else pc.lineTo(x,y);});pc.stroke();
    }
    timeSlider.value=step;$("timeValue").textContent=(step/stepsPerCrossing).toFixed(2);
  }
  function pause(){playing=false;cancelAnimationFrame(frame);frame=0;$("play").textContent="▶ Play";}
  function rebuild(){pause();step=0;
    const left=$("left").value,right=$("right").value;
    for(const [id,side] of [["leftLabel",left],["rightLabel",right]]){
      const el=$(id);el.textContent=side==="open"?"Open":"Closed";el.classList.toggle("closed",side==="closed");
    }
    field=simulate(left,right,$("pulse").value,$("direction").value);rebuildRaster();draw();
  }
  function animate(ts){if(!playing)return;if(!last)last=ts;accum+=(ts-last)*.16;last=ts;
    const diff=Math.floor(accum);accum-=diff;step=Math.min(totalSteps,step+diff);draw();
    if(step>=totalSteps)pause();else frame=requestAnimationFrame(animate);
  }
  for(const id of ["left","right","pulse","direction"])$(id).addEventListener("change",rebuild);
  $("quantity").addEventListener("change",()=>{rebuildRaster();draw();});
  timeSlider.addEventListener("input",()=>{pause();step=Number(timeSlider.value);draw();});
  $("reset").addEventListener("click",()=>{pause();step=0;draw();});
  $("play").addEventListener("click",()=>{if(playing){pause();return;}if(step>=totalSteps)step=0;playing=true;last=0;accum=0;$("play").textContent="Ⅱ Pause";frame=requestAnimationFrame(animate);});
  rebuild();
}
