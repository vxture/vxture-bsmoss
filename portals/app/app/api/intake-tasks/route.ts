import { cookies } from "next/headers";
import { getOidcConfig } from "../../auth/lib/config";
import { intakeTasksForSession } from "../../domains/access/runtime";
import { intakeHttpError, privateIntakeResponse } from "../../domains/integration/intake-http";
import { intakeListFromUrl } from "../../domains/integration/intake-queries";
import { errorResponse } from "../../platform/envelope";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  if (!cfg.enabled || !sid) return privateIntakeResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
  try { return privateIntakeResponse(Response.json(await intakeTasksForSession(sid).list(intakeListFromUrl(new URL(request.url))))); } catch (e) { return intakeHttpError(e); }
}
