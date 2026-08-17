#!/usr/bin/env node
/**
 * mock-hydradb.mjs — DEVELOPMENT STAND-IN, NOT HydraDB.
 *
 * An in-memory server that implements the HydraDB HTTP query API contract
 * (POST /v1/graphs/{graph}/query — see src/client/http.rs in hydra-db/hydradb)
 * for exactly the statements the app sends:
 *
 *   RETURN 1 AS ok
 *   MERGE (p:Package {name: "..."}) SET ...
 *   MERGE (a:Package {name: "..."}) MERGE (b:Package {name: "..."})
 *     MERGE (a)-[:DEPENDS_ON]->(b)
 *   MATCH (p:Package) RETURN count(p) AS packages
 *   MATCH ()-[:DEPENDS_ON]->() RETURN count(*) AS edges
 *   MATCH (p:Package)-[:DEPENDS_ON*1..N]->(c:Package)
 *     WHERE c.name = $name RETURN DISTINCT p.name AS name
 *
 * Use it only to develop/rehearse on machines that cannot run the real node.
 * The real HydraDB node (Docker or source build — see README) is required for
 * the actual submission demo.
 *
 * Usage:  node scripts/mock-hydradb.mjs [port]      (default 8444)
 * Point the app at it:  HYDRADB_URL=http://127.0.0.1:8444  (see .env.local)
 */

import http from "node:http";

const PORT = Number(process.argv[2] ?? 8444);

/* ----------------------------- graph state ----------------------------- */

/** name -> { group?, version?, downloads?, scannedAt? } */
const nodes = new Map();
/** source -> Set(target) */
const edges = new Map();

function ensureNode(name) {
  if (!nodes.has(name)) nodes.set(name, {});
  return nodes.get(name);
}

function addEdge(source, target) {
  ensureNode(source);
  ensureNode(target);
  if (!edges.has(source)) edges.set(source, new Set());
  edges.get(source).add(target);
}

/** Reverse closure: sources that reach `target` within `maxDepth` hops. */
function reverseClosure(target, maxDepth) {
  const reverse = new Map(); // node -> Set(upstream)
  for (const [src, targets] of edges) {
    for (const t of targets) {
      if (!reverse.has(t)) reverse.set(t, new Set());
      reverse.get(t).add(src);
    }
  }
  const seen = new Set([target]);
  const exposed = new Set();
  let frontier = new Set([target]);
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = new Set();
    for (const node of frontier) {
      for (const up of reverse.get(node) ?? []) {
        if (seen.has(up)) continue;
        seen.add(up);
        exposed.add(up);
        next.add(up);
      }
    }
    frontier = next;
  }
  return [...exposed].sort();
}

/* ------------------------------ query eval ----------------------------- */

function evalQuery(cypher, parameters) {
  const q = cypher.trim();

  if (/^RETURN\s+1\s+AS\s+ok/i.test(q)) {
    return { columns: ["ok"], rows: [[{ type: "integer", value: 1 }]] };
  }

  // MERGE (a:Package {...}) MERGE (b:Package {...}) MERGE (a)-[:DEPENDS_ON]->(b)
  let edgeMatch = q.match(
    /MERGE\s+\(a:Package\s*\{name:\s*"([^"]+)"\}\)[\s\S]*?MERGE\s+\(b:Package\s*\{name:\s*"([^"]+)"\}\)[\s\S]*?MERGE\s+\(a\)-\[:DEPENDS_ON\]->\(b\)/
  );
  if (edgeMatch) {
    addEdge(edgeMatch[1], edgeMatch[2]);
    return { columns: [], rows: [] };
  }

  // MERGE (p:Package {name:"..."}) SET p.version = "...", p.downloads = N, ...
  let nodeMatch = q.match(
    /MERGE\s+\(p:Package\s*\{name:\s*"([^"]+)"\}\)\s+SET\s+([\s\S]+)$/
  );
  if (nodeMatch) {
    const props = ensureNode(nodeMatch[1]);
    const setClause = nodeMatch[2];
    for (const assignment of setClause.split(",")) {
      const kv = assignment.match(/(\w+)\s*=\s*(.+)$/);
      if (!kv) continue;
      let value = kv[2].trim();
      if (value.startsWith('"')) value = value.slice(1, -1);
      else if (/^\d+$/.test(value)) value = Number(value);
      else if (value === "timestamp()") value = Date.now();
      props[kv[1]] = value;
    }
    return { columns: [], rows: [] };
  }

  // MATCH (p:Package) RETURN count(p) AS packages
  if (/MATCH\s+\(p:Package\)\s+RETURN\s+count\(p\)/i.test(q)) {
    return {
      columns: ["packages"],
      rows: [[{ type: "integer", value: nodes.size }]],
    };
  }

  // MATCH ()-[:DEPENDS_ON]->() RETURN count(*) AS edges
  if (/MATCH\s+\(\)-\[:DEPENDS_ON\]->\(\)\s+RETURN\s+count\(\*\)/i.test(q)) {
    let total = 0;
    for (const targets of edges.values()) total += targets.size;
    return { columns: ["edges"], rows: [[{ type: "integer", value: total }]] };
  }

  // MATCH (p:Package)-[:DEPENDS_ON*1..N]->(c:Package) WHERE c.name = $name
  //   RETURN DISTINCT p.name AS name
  const closureMatch = q.match(
    /\[:DEPENDS_ON\*1\.\.(\d+)\]->\(c:Package\)\s+WHERE\s+c\.name\s*=\s*\$(\w+)\s+RETURN\s+DISTINCT\s+p\.name\s+AS\s+name/i
  );
  if (closureMatch) {
    const maxDepth = Number(closureMatch[1]);
    const param = closureMatch[2];
    const target = parameters?.[param];
    const names = typeof target === "string" ? reverseClosure(target, maxDepth) : [];
    return {
      columns: ["name"],
      rows: names.map((n) => [{ type: "string", value: n }]),
    };
  }

  return { columns: [], rows: [] };
}

/* ------------------------------- server -------------------------------- */

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const ok =
    req.method === "GET" && url.pathname === "/readyz"
      ? true
      : req.method === "POST" && /^\/v1\/graphs\/[^/]+\/query$/.test(url.pathname);

  if (!ok) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ code: "ResourceNotFound", message: `${url.pathname} does not exist` }));
    return;
  }

  if (req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    let parsed = {};
    try {
      parsed = JSON.parse(body);
    } catch {
      /* fall through */
    }
    const cypher = typeof parsed.query === "string" ? parsed.query : "";
    const result = evalQuery(cypher, parsed.parameters ?? {});
    const payload = {
      query_id: "mock-query",
      ...result,
      read_epoch: 0,
      next_cursor: null,
      bookmark: null,
    };
    const log =
      cypher.replace(/\s+/g, " ").slice(0, 90) ||
      `${req.method} ${url.pathname}`;
    console.log(`[mock-hydradb] ${log}  → ${result.rows.length} rows`);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-hydradb] listening on http://127.0.0.1:${PORT}`);
  console.log("[mock-hydradb] DEV STAND-IN for the HydraDB query API — not HydraDB itself.");
});
