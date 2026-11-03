import type { WorkerIdentityProvider } from "../../platform/worker-identity.ts";
import { productionAccessPorts } from "./production-ports.ts";
import type { VerifiedServiceIdentity } from "./resolve.ts";

// Only trusted server composition calls this; never derive configuration from HTTP.
export function workerAccessPorts(
  workspaceId: string, provider: WorkerIdentityProvider,
  dependencies: Parameters<typeof productionAccessPorts>[1],
) {
  return productionAccessPorts(async (): Promise<VerifiedServiceIdentity> => {
    const proof = await provider();
    if (proof.workspaceId !== workspaceId || proof.callerProduct !== "bsmoss") throw Error("worker_identity_invalid");
    return { kind: "service", sub: "s2s:bsmoss", callerProduct: "bsmoss", activeWorkspace: workspaceId,
      expiresAt: proof.expiresAt, tokenId: proof.tokenId };
  }, dependencies);
}
