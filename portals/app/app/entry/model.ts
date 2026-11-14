export type EntryState='signin'|'connecting'|'restoring'|'checking-access'|'unavailable'|'recovery'|'signed-out'|'unassigned'|'connected';
export interface EntryIdentity {displayName:string;organization:string|null}
export interface EntryResult {state:EntryState;identity?:EntryIdentity}
