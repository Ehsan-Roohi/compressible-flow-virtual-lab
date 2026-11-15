// Keep solver IDs stable while displaying textbook region numbers.
export const isFlatPlate=r=>r.geometry?.upper.length===2&&r.geometry?.lower.length===2&&[...r.geometry.upper,...r.geometry.lower].every(p=>Math.abs(p.y)<1e-12);
export function airfoilRegionLabel(r,id){
 if(isFlatPlate(r))return ({U1:'2',L1:'3','TE-U−':'2','TE-L−':'3','TE-U+':'4','TE-L+':'5'})[id]??id;
 if(!r.geometry?.diamond)return id;
 return ({U1:'2',U2:'3',L1:'4',L2:'5','TE-U−':'3','TE-L−':'5','TE-U+':'6 (upper)','TE-L+':'6 (lower)'})[id]??id;
}
export function airfoilShockLabel(r,w){
 if(isFlatPlate(r))return ({U1:'β₁₂',L1:'β₁₃','TE-U':'β₂₄','TE-L':'β₃₅'})[w.id]??'β';
 if(!r.geometry?.diamond)return 'β';
 return ({U1:'β₁₂',L1:'β₁₄','TE-U':'β₃₆','TE-L':'β₅₆'})[w.id]??'β';
}
