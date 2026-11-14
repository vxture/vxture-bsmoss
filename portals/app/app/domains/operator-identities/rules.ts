export const PARTY_CODES = ["tower", "mobile", "unicom", "telecom", "broadcast", "other"] as const;
export type PartyCode = string;
export type IdentityAction = "create" | "update";
export const MAX_IDENTITIES = 100;
export const GENERIC_LOGO = "/assets/operators/other.svg";
export interface OperatorIdentityRecord { code: PartyCode; fullName: string; shortName: string; logo: string }
export interface OperatorIdentityCatalog { revision: number; items: OperatorIdentityRecord[]; updatedAt: string | null }
export const DEFAULT_IDENTITIES: readonly OperatorIdentityRecord[] = [
  {code:"tower",fullName:"\u4e2d\u56fd\u94c1\u5854\u80a1\u4efd\u6709\u9650\u516c\u53f8",shortName:"\u94c1\u5854",logo:"/assets/operators/tower.svg"},
  {code:"mobile",fullName:"\u4e2d\u56fd\u79fb\u52a8\u901a\u4fe1\u96c6\u56e2\u6709\u9650\u516c\u53f8",shortName:"\u79fb\u52a8",logo:"/assets/operators/mobile.svg"},
  {code:"unicom",fullName:"\u4e2d\u56fd\u8054\u5408\u7f51\u7edc\u901a\u4fe1\u96c6\u56e2\u6709\u9650\u516c\u53f8",shortName:"\u8054\u901a",logo:"/assets/operators/unicom.svg"},
  {code:"telecom",fullName:"\u4e2d\u56fd\u7535\u4fe1\u96c6\u56e2\u6709\u9650\u516c\u53f8",shortName:"\u7535\u4fe1",logo:"/assets/operators/telecom.svg"},
  {code:"broadcast",fullName:"\u4e2d\u56fd\u5e7f\u64ad\u7535\u89c6\u7f51\u7edc\u96c6\u56e2\u6709\u9650\u516c\u53f8",shortName:"\u5e7f\u7535",logo:"/assets/operators/broadcast.svg"},
  {code:"other",fullName:"\u5176\u4ed6\u8fd0\u8425\u4e3b\u4f53",shortName:"\u5176\u4ed6",logo:"/assets/operators/other.svg"},
];
export function defaultCatalog(): OperatorIdentityCatalog { return {revision:0,items:DEFAULT_IDENTITIES.map(item=>({...item})),updatedAt:null}; }
export const MAX_LOGO_BYTES = 512 * 1024;
function name(raw: unknown, limit: number) {
  if(typeof raw!=="string"||!raw.trim()||raw.trim().length>limit||/[\u0000-\u001f\u007f]/.test(raw))throw Error("invalid_operator_identity");
  return raw.trim();
}
export function identityRecord(raw: unknown): OperatorIdentityRecord {
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("invalid_operator_identity");
  const r=raw as Record<string,unknown>;
  if(Object.keys(r).sort().join()!=="code,fullName,logo,shortName"||typeof r.code!=="string"||!(PARTY_CODES.some(code=>code===r.code)||/^provider_[a-f0-9]{32}$/.test(r.code)))throw Error("invalid_operator_identity");
  const code=r.code as PartyCode, logo=r.logo;
  const defaultLogo=DEFAULT_IDENTITIES.find(item=>item.code===code)?.logo??GENERIC_LOGO;
  if(typeof logo!=="string")throw Error("invalid_operator_logo");
  if(logo!==defaultLogo){
    const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(logo);
    if(!match||match[2].length%4!==0||match[2].length>Math.ceil(MAX_LOGO_BYTES/3)*4)throw Error("invalid_operator_logo");
    // Verify magic bytes as well as MIME. SVG/HTML and remote URLs are not uploads.
    const prefix=match[2].slice(0,16);
    if(!(match[1]==="png"&&prefix.startsWith("iVBORw0KGgo")||match[1]==="jpeg"&&prefix.startsWith("/9j/")||match[1]==="webp"&&prefix.startsWith("UklGR")&&atob(prefix).slice(8,12)==="WEBP"))throw Error("invalid_operator_logo");
  }
  return {code,fullName:name(r.fullName,80),shortName:name(r.shortName,12),logo};
}
export function identityCommand(raw: unknown) {
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("invalid_operator_identity");
  const r=raw as Record<string,unknown>;
  if(!["record,revision","action,record,revision"].includes(Object.keys(r).sort().join())||!Number.isSafeInteger(r.revision)||Number(r.revision)<0||Number(r.revision)>=Number.MAX_SAFE_INTEGER||!(r.action===undefined||r.action==="create"||r.action==="update"))throw Error("invalid_operator_identity");
  return {revision:Number(r.revision),record:identityRecord(r.record),action:(r.action??"update") as IdentityAction};
}
export function readCatalog(raw: unknown): OperatorIdentityCatalog {
  const r=raw as OperatorIdentityCatalog;
  if(!r||!Number.isSafeInteger(r.revision)||r.revision<0||!Array.isArray(r.items)||r.items.length<PARTY_CODES.length||r.items.length>MAX_IDENTITIES||!(r.updatedAt===null||typeof r.updatedAt==="string"&&Number.isFinite(Date.parse(r.updatedAt))))throw Error("invalid_operator_catalog");
  const items=r.items.map(identityRecord);
  if(new Set(items.map(item=>item.code)).size!==items.length||!PARTY_CODES.every(code=>items.some(item=>item.code===code)))throw Error("invalid_operator_catalog");
  return {revision:r.revision,items:[...PARTY_CODES.map(code=>items.find(item=>item.code===code)!),...items.filter(item=>!PARTY_CODES.some(code=>code===item.code))],updatedAt:r.updatedAt};
}
export function applyIdentity(catalog:OperatorIdentityCatalog,raw:OperatorIdentityRecord,action:IdentityAction):OperatorIdentityRecord[]{
  const record=identityRecord(raw),exists=catalog.items.some(item=>item.code===record.code);
  if(action==="create"&&(exists||PARTY_CODES.some(code=>code===record.code)))throw Error("operator_identity_conflict");
  if(action==="update"&&!exists)throw Error("invalid_operator_missing");
  if(action==="create"&&catalog.items.length>=MAX_IDENTITIES)throw Error("invalid_operator_limit");
  const key=(value:string)=>value.normalize("NFKC").toLocaleLowerCase("en-US");
  if(catalog.items.some(item=>item.code!==record.code&&(key(item.fullName)===key(record.fullName)||key(item.shortName)===key(record.shortName))))throw Error("operator_identity_conflict");
  return action==="create"?[...catalog.items,record]:catalog.items.map(item=>item.code===record.code?record:item);
}
