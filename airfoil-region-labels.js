// Keep solver panel IDs stable; apply textbook numbering only to Diamond views.
export function airfoilRegionLabel(r,id){
 if(!r.geometry?.diamond)return id;
 return ({U1:'2',U2:'3',L1:'4',L2:'5','TE-U−':'3','TE-L−':'5','TE-U+':'6 (upper)','TE-L+':'6 (lower)'})[id]??id;
}
export function airfoilShockLabel(r,w){
 if(!r.geometry?.diamond)return 'β';
 return ({U1:'β₁₂',L1:'β₁₄','TE-U':'β₃₆','TE-L':'β₅₆'})[w.id]??'β';
}
