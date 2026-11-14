"use client";
import {useState} from "react";
import {DEFAULT_IDENTITIES,GENERIC_LOGO} from "../domains/operator-identities/rules";
import {useOperatorCatalog} from "./operator-identities";
import "./operator-identity.css";
export function OperatorLogo({code,size="inline"}:{code:string;size?:"inline"|"large"}) {
 const catalog=useOperatorCatalog(),record=catalog.items.find(item=>item.code===code);
 const [failed,setFailed]=useState<string|null>(null);
 if(!record)return null;
 const src=failed===record.logo?DEFAULT_IDENTITIES.find(item=>item.code===code)?.logo??GENERIC_LOGO:record.logo;
 return <img src={src} alt="" className={"operator-logo operator-logo-"+size} onError={()=>setFailed(record.logo)}/>;
}
export function OperatorName({code,full=false}:{code:string;full?:boolean}){const item=useOperatorCatalog().items.find(item=>item.code===code);return <span title={item?.fullName}>{item?(full?item.fullName:item.shortName):code==="all"?"\u5168\u90e8\u8fd0\u8425\u5546":code}</span>;}
export default function OperatorIdentity({code}:{code:string}) {
 return <span className="operator-identity inline-flex items-center gap-xs whitespace-nowrap text-foreground"><OperatorLogo code={code}/><OperatorName code={code}/></span>;
}
