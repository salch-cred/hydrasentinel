import { NextRequest } from "next/server";
import { traversePackage } from "@/lib/registry";
import { hydradbPing, hydradbStats, hydradbUpsertTraversal } from "@/lib/hydradb";

export const dynamic = "force-dynamic";

/**
 * GET /api/hydradb/seed?packages=express,lodash,left-pad
 *
 * Traverses each package against the live npm registry and persists the real
 * dependency subgraphs into HydraDB, so reverse-closure queries have data to
 * answer. Defaults to the app's monitored set. Returns a JSON summary.
 */
export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("packages");
  const packages = requested
    ? requested
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : [
        "react-dom",
        "express",
        "lodash",
        "commander",
        "is-odd",
        "chalk",
        "axios",
        "uuid",
        "moment",
        "debug",
        "minimist",
        "underscore",
      ];

  if (!(await hydradbPing())) {
    return Response.json(
      {
        ok: false,
        error:
          "HydraDB node unreachable. Start one (see README) or set HYDRADB_URL / HYDRADB_DISABLED=1.",
        packages: 0,
        edges: 0,
      },
      { status: 503 }
    );
  }

  const seeded: string[] = [];
  const failed: string[] = [];
  for (const pkg of packages) {
    try {
      const result = await traversePackage(pkg, () => {});
      const ok = await hydradbUpsertTraversal(result);
      if (ok) seeded.push(pkg);
      else failed.push(pkg);
    } catch {
      failed.push(pkg);
    }
  }

  const stats = await hydradbStats();
  return Response.json({
    ok: failed.length === 0,
    requested: packages.length,
    seeded,
    failed,
    packages: stats?.packages ?? 0,
    edges: stats?.edges ?? 0,
  });
}
