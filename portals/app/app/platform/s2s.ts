// Adapted from the yucer engineering reference for product bsmoss.
export interface S2SConfig {
  tokenUrl: string; clientId: string; clientSecret: string; productCode: string; enabled: boolean;
}
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
export function getS2SConfig(env: Record<string,string|undefined> = process.env): S2SConfig {
  const clientId=(env.S2S_CLIENT_ID?.trim() || env.OIDC_CLIENT_ID?.trim() || "bsmoss");
  const clientSecret=env.S2S_CLIENT_SECRET?.trim() || env.OIDC_CLIENT_SECRET?.trim() || "";
  const issuer=env.OIDC_ISSUER?.trim().replace(/\/$/,"") || "https://accounts.vxture.com";
  return {tokenUrl:env.S2S_TOKEN_URL?.trim() || issuer+"/oidc/token",clientId,clientSecret,
    productCode:"bsmoss",enabled:Boolean(clientSecret) && ["bsmoss","bsmoss-beta"].includes(clientId)};
}
