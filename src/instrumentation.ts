import type { Instrumentation } from "next";
import { reportError } from "@/lib/report-error";

export function register() {}

/** Serverfehler → Sentry (nur Pfad ohne Query, keine Header/Cookies) */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  await reportError(err, {
    path: (request.path ?? "").split("?")[0] ?? "",
    method: request.method ?? "",
    routeType: context.routeType,
    routePath: context.routePath,
  });
};
