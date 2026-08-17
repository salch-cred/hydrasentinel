import { NextRequest } from "next/server";
import { traversePackage } from "@/lib/registry";
import { hydradbGraphInfo, hydradbUpsertTraversal } from "@/lib/hydradb";

export const dynamic = "force-dynamic";

/**
 * GET /api/traverse?package=left-pad
 *
 * Streams newline-delimited JSON: `{type:"log",message}` lines as the real
 * registry traversal progresses, then `{type:"result"}`, then a final
 * `{type:"hydradb"}` line reporting graph connectivity + reverse closure.
 */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("package")?.trim();
  if (!name) {
    return Response.json({ error: "missing ?package= parameter" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
      try {
        const result = await traversePackage(name, (message) => send({ type: "log", message }));
        send({ type: "result", ...result });
        // Best-effort HydraDB: persist this scan into the graph, then report
        // connectivity + the transitive reverse closure (who depends on this).
        const info = await (async () => {
          await hydradbUpsertTraversal(result);
          return hydradbGraphInfo(result.target.name);
        })();
        send({ type: "hydradb", ...info });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "traversal failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
