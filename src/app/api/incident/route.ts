import { NextRequest } from "next/server";
import { buildIncidentReport } from "@/lib/incident";

export const dynamic = "force-dynamic";

/**
 * GET /api/incident?package=lodash&hours=6
 *
 * Simulates a compromise of the resolved version: real publish timeline from
 * the registry packument, the window the bad version was live, and the known
 * dependents exposed (from the HydraDB reverse closure).
 */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("package")?.trim();
  if (!name) {
    return Response.json({ error: "missing ?package= parameter" }, { status: 400 });
  }
  const hours = Math.min(
    72,
    Math.max(1, Number(request.nextUrl.searchParams.get("hours") ?? 6))
  );

  try {
    const report = await buildIncidentReport(name, hours);
    return Response.json({ ok: true, report });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "incident simulation failed",
      },
      { status: 502 }
    );
  }
}
