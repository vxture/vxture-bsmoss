// Source references and names are untrusted spreadsheet text, never formulas.
export const evidenceCsvCell=(v:unknown)=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'$&").replace(/"/g,'""')+'"';
