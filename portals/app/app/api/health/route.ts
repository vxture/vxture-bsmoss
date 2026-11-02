export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ status: "ok", product: "bsmoss", version: process.env.APP_VERSION ?? "dev", gitSha: process.env.GIT_SHA ?? "unknown" }, { headers: { "cache-control": "no-store" } });
}
