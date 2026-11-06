import { cookies } from "next/headers";
import { getOidcConfig } from "../../../auth/lib/config";
import { dataUpdatesForSession } from "../../../domains/access/runtime";
import { updateHttpError } from "../../../domains/data-updates/http";
import { privateJobResponse } from "../../../domains/supervision/http";
import { errorResponse } from "../../../platform/envelope";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  if (!cfg.enabled || !sid) return privateJobResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
  if (new URL(request.url).search) return privateJobResponse(errorResponse(400, "UPDATE_INVALID_COMMAND", "Invalid update query"));
  try {
    const task = await dataUpdatesForSession(sid).read((await context.params).id);
    return privateJobResponse(task ? Response.json(task) : errorResponse(404, "UPDATE_UNAVAILABLE", "Update unavailable"));
  } catch (e) { return updateHttpError(e); }
}
