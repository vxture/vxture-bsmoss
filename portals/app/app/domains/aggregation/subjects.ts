import { jobIdentity } from "./refresh-jobs.ts";

export function mappedSubject(stationId: string, serviceId: string | null, networkObjectId: string | null, deviceId: string | null) {
  jobIdentity(stationId);
  for (const value of [serviceId, networkObjectId, deviceId]) if (value !== null) jobIdentity(value);
  return JSON.stringify(["mapped-object-v1", stationId, serviceId, networkObjectId, deviceId]);
}
