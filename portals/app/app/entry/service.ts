import type {AuthUser} from '../auth/lib/claims';
import type {EntryResult} from './model';
export interface EntryPorts {enabled:boolean;sessionId?:string;signedOut:boolean;readUser:(sid:string)=>Promise<AuthUser|null>}
// Third-party sign-in projects identity only; it does not read product entitlements.
export async function readEntryState(ports:EntryPorts):Promise<EntryResult>{
 if(!ports.enabled)return {state:'unavailable'};
 if(!ports.sessionId)return {state:ports.signedOut?'signed-out':'signin'};
 let user;try{user=await ports.readUser(ports.sessionId);}catch{return {state:'unavailable'};}
 if(!user)return {state:'recovery'};
 const identity={displayName:user.displayName,organization:user.activeOrgName};
 if(user.accountStatus!=='active')return {state:'unassigned',identity};
 return {state:'connected',identity};
}
