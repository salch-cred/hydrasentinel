import { NextRequest } from "next/server";
import { analyzeYourServices } from "@/lib/yourservices";

export const dynamic = "force-dynamic";

/**
 * POST /api/yourservices  { manifest: "<package.json contents>" }
 *
 * Resolves the app's declared ranges against real registry versions, builds
 * the transitive tree, registers the app as a :Service in HydraDB, and returns
 * the riskiest dependency + exposure paths if it were compromised.
 */
export async function POST(request: NextRequest) {
  let manifest: string;
  try {
    const body = (await request.json()) as { manifest?: string };
    manifest = body.manifest ?? "";
  } catch {
    return Response.json({ ok: false, error: "expected a JSON body with a manifest" }, { status: 400 });
  }
  if (!manifest.trim()) {
    return Response.json({ ok: false, error: "paste a package.json first" }, { status: 400 });
  }
  try {
    const report = await analyzeYourServices(manifest);
    return Response.json(report);
  } catch (err) {
    return Response.json(
      {
        ok: false,
        app: { name: "your-app", directDeps: 0, treeNodes: 0, edges: 0, nodes: [], links: [] },
        exposedPaths: [],
        registeredInHydradb: false,
        error: err instanceof Error ? err.message : "analysis failed",
      },
      { status: 502 }
    );
  }
}
