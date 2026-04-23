import type { RouteContext } from "@/lib/server/request-context";
import { jsonWithContext, logRouteError } from "@/lib/server/request-context";

export function handleStripeRouteError(
  context: RouteContext,
  userMessage: string,
  error: unknown,
): Response {
  logRouteError(context, "Request failed.", error);
  return jsonWithContext({ error: userMessage }, { status: 500 }, context);
}
