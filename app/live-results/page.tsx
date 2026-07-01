import { redirect } from "next/navigation";
import { LEGACY_ROUTE_TARGETS } from "@/app/lib/legacy-routes";

/** @deprecated Use /clinician/results */
export default function LiveResultsRedirect() {
  redirect(LEGACY_ROUTE_TARGETS.liveResults);
}
