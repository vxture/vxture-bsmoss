import { getPool } from "../../lib/db";
import { PgProvisioningStore } from "./pg-store";
let store: PgProvisioningStore | undefined;
export function getProvisioningStore() { return store ??= new PgProvisioningStore(getPool()); }
