// S2S egress guard. Platform calls carry confidential credentials or Bearer tickets,
// so cleartext http is allowed ONLY to loopback / private / tailnet hosts; http
// to a public host is refused (the secret must never cross the public internet
// in the clear). https is allowed anywhere.

import { isIP } from "node:net";

const PRIVATE_V4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT / tailnet 100.64.0.0/10
];

const PRIVATE_HOST_SUFFIX = [".ts.net", ".tailnet", ".internal"];

function isPrivateHost(host: string): boolean {
  if (host === "localhost") return true;
  if (isIP(host) === 4 && PRIVATE_V4.some((re) => re.test(host))) return true;
  if (host === "::1" || host === "[::1]") return true;
  return PRIVATE_HOST_SUFFIX.some((s) => host.endsWith(s));
}

/** Throws if the URL is not a safe internal target for a secret-bearing call. */
export function assertInternalTarget(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.username || url.password) throw new Error("target_credentials_forbidden");
  if (url.protocol === "https:") return url;
  if (url.protocol === "http:" && isPrivateHost(url.hostname)) return url;
  throw new Error(
    `refusing cleartext egress to public host '${url.hostname}': ` +
      "credentials must not cross the public internet in the clear",
  );
}
