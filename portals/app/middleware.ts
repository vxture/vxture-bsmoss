import { NextResponse, type NextRequest } from "next/server";
import { authenticatedDemoEnabled } from "./app/lib/demo-mode";
import { getOidcConfig } from "./app/auth/lib/config";
import { getAuthUser } from "./app/auth/lib/session";

// The shared demo is authenticated and read-only, including direct API access.
export async function middleware(request: NextRequest) {
 if (!authenticatedDemoEnabled()) return NextResponse.next();
 const path = request.nextUrl.pathname;
 if (/^\/(?:auth(?:\/|$)|entry$|api\/(?:auth\/oidc\/callback$|entry-status$|health$|ready$|webhooks\/vxture$)|_next\/|favicon\.ico$)/.test(path)) return NextResponse.next();
 if (/^\/(?:fonts|map-assets|brand|images)\//.test(path)) return NextResponse.next();
 const cfg = getOidcConfig(), sid = request.cookies.get(cfg.cookieName)?.value;
 const user = cfg.enabled && sid ? await getAuthUser(cfg, sid).catch(() => null) : null;
 if (user?.accountStatus !== "active") {
  if (path.startsWith("/api/")) return NextResponse.json({error:"AUTH_REQUIRED"},{status:401,headers:{"Cache-Control":"private, no-store"}});
  const entry = new URL("/entry", cfg.appOrigin || request.nextUrl.origin);
  entry.searchParams.set("returnTo", path + request.nextUrl.search);
  const response = NextResponse.redirect(entry);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
 }
 const previewCalculation = path === "/api/product-preview" && request.method === "POST";
 if (path.startsWith("/api/") && !["GET","HEAD"].includes(request.method) && !previewCalculation)
  return NextResponse.json({error:"DEMO_READ_ONLY"},{status:405,headers:{Allow:"GET, HEAD"}});
 const response = NextResponse.next();
 response.headers.set("Cache-Control", "private, no-store");
 return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)"], runtime: "nodejs" };
