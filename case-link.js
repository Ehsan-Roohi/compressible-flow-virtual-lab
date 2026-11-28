const maxTokenLength=24000;
const inputKey=/^[a-z][a-z\d_]*$/i;
const invalidText=/[<>"'`\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

function validValue(value,depth=0){
 if(typeof value==='string')return value.length<=6000&&!invalidText.test(value);
 if(typeof value==='number')return Number.isFinite(value);
 if(typeof value==='boolean'||value===null)return true;
 if(depth>=3)return false;
 if(Array.isArray(value))return value.length<=120&&value.every(item=>validValue(item,depth+1));
 return isRecord(value)&&Object.entries(value).every(([key,item])=>
  inputKey.test(key)&&!Object.hasOwn(Object.prototype,key)&&validValue(item,depth+1));
}

function sameInputType(value,reference){
 if(reference==null)return true;
 if(Array.isArray(reference)){
  return Array.isArray(value)&&value.every(item=>sameInputType(item,reference[0]));
 }
 if(isRecord(reference)){
  return isRecord(value)&&Object.entries(reference).every(([key,item])=>
   !Object.hasOwn(value,key)||sameInputType(value[key],item));
 }
 return typeof value===typeof reference;
}

export function restoreCaseInputs(defaults,inputs,fields=[]){
 const schema={...defaults,...Object.fromEntries(fields.map(({key,value})=>[key,value??defaults[key]]))};
 const accepted=Object.entries(inputs).filter(([key,value])=>
  Object.hasOwn(schema,key)&&sameInputType(value,schema[key]));
 return {...defaults,...Object.fromEntries(accepted)};
}

export function makeCaseLink(currentURL,lab,inputs,units,plot,plotX){
 const snapshot=Object.fromEntries(Object.entries(inputs).filter(([,value])=>value!==undefined));
 if(!validValue(snapshot))throw Error('Complete the inputs before copying the case link.');
 const data=new TextEncoder().encode(JSON.stringify({v:1,inputs:snapshot,units,plot,plotX}));
 const token=btoa(Array.from(data,byte=>String.fromCharCode(byte)).join(''))
  .replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
 if(token.length>maxTokenLength)throw Error('This case is too large for a shareable link.');
 const url=new URL(currentURL);
 url.search='';
 url.hash=`${lab}?${new URLSearchParams({case:token})}`;
 return url.href;
}

export function readCaseLink(token){
 if(!token||token.length>maxTokenLength||!/^[A-Za-z0-9_-]+$/.test(token))return null;
 try{
  const data=Uint8Array.from(atob(token.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
  const decoded=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));
  const validPlot=plot=>plot===undefined||typeof plot==='string'&&validValue(plot);
  if(decoded?.v!==1||!['SI','US'].includes(decoded.units)||!isRecord(decoded.inputs)||
     !validValue(decoded.inputs)||!validPlot(decoded.plot)||!validPlot(decoded.plotX))return null;
  return {inputs:decoded.inputs,units:decoded.units,plot:decoded.plot,...(decoded.plotX===undefined?{}:{plotX:decoded.plotX})};
 }catch{return null;}
}
