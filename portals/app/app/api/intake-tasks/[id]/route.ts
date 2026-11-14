import { cookies } from "next/headers";
import { getOidcConfig } from "../../../auth/lib/config";
import { intakeTasksForSession } from "../../../domains/access/runtime";
import { intakeHttpError, privateIntakeResponse } from "../../../domains/integration/intake-http";
import { errorResponse } from "../../../platform/envelope";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  if (!cfg.enabled || !sid) return privateIntakeResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
  if (new URL(request.url).search) return privateIntakeResponse(errorResponse(400, "INTAKE_INVALID_COMMAND", "Invalid intake query"));
  try { return privateIntakeResponse(Response.json(await intakeTasksForSession(sid).read((await context.params).id))); } catch (e) { return intakeHttpError(e); }
}
