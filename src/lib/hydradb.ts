/**
 * HydraDB client for HydraSentinel.
 *
 * Talks to a local HydraDB node over its HTTPS/HTTP query API
 * (POST /v1/graphs/{graph}/query — OpenCypher over JSON). The contract below
 * mirrors src/client/http.rs in the hydra-db/hydradb repo:
 *   request:  { cell_id, query, parameters?, page_size?, page_cursor? }
 *   response: { columns: string[], rows: [{type,value}[][]], next_cursor? }
 *
 * Everything is best-effort: if the node is unreachable or misconfigured, every
 * function degrades gracefully so the explorer still works on live registry data.
 */

import type { TraverseResult } from "@/lib/registry";

export interface HydradbConfig {
  url: string;
  token: string;
  graph: string;
  cell: string;
  namespace: string;
  timeoutMs: number;
  disabled: boolean;
}

interface HydradbCell {
  type?: string;
  value?: unknown;
}

interface HydradbQueryResponse {
  columns?: string[];
  rows?: unknown[][];
  next_cursor?: number | null;
}

export interface HydradbGraphInfo {
  connected: boolean;
  packages: number;
  edges: number;
  reverse: string[];
  reverseDepth: number;
  error?: string;
}

const DEFAULT_TOKEN = "local-development-token-32-bytes";

export function loadHydradbConfig(): HydradbConfig {
  const disabled = process.env.HYDRADB_DISABLED === "1" || process.env.HYDRADB_DISABLED === "true";
  return {
    url: (process.env.HYDRADB_URL ?? "http://127.0.0.1:8443").replace(/\/$/, ""),
    token: process.env.HYDRADB_TOKEN ?? DEFAULT_TOKEN,
    graph: process.env.HYDRADB_GRAPH ?? "default",
    cell: process.env.HYDRADB_CELL ?? "cell-0",
    namespace: process.env.HYDRADB_NAMESPACE ?? "default",
    timeoutMs: Number(process.env.HYDRADB_TIMEOUT_MS ?? 1500),
    disabled,
  };
}

async function postQuery(
  config: HydradbConfig,
  cypher: string,
  parameters?: Record<string, string | number | boolean>,
  pageCursor?: number
): Promise<HydradbQueryResponse | null> {
  if (config.disabled) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.timeoutMs);
  try {
    const res = await fetch(`${config.url}/v1/graphs/${encodeURIComponent(config.graph)}/query`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "X-Graph-Namespace": config.namespace,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cell_id: config.cell,
        query: cypher,
        ...(parameters ? { parameters } : {}),
        page_size: 256,
        ...(typeof pageCursor === "number" ? { page_cursor: pageCursor } : {}),
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as HydradbQueryResponse;
    return body;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Collect all rows for a query, following pagination (bounded). */
async function queryAll(
  config: HydradbConfig,
  cypher: string,
  parameters?: Record<string, string | number | boolean>
): Promise<HydradbQueryResponse | null> {
  const page = await postQuery(config, cypher, parameters);
  if (!page) return null;
  const rows: unknown[][] = [...(page.rows ?? [])];
  let cursor = page.next_cursor;
  for (let i = 0; i < 8 && typeof cursor === "number"; i++) {
    const next = await postQuery(config, cypher, parameters, cursor);
    if (!next) break;
    rows.push(...(next.rows ?? []));
    cursor = next.next_cursor;
  }
  return { ...page, rows };
}

/** Readiness check: a round-tripped query, not just a listening port. */
export async function hydradbPing(): Promise<boolean> {
  const config = loadHydradbConfig();
  if (config.disabled) return false;
  const body = await postQuery(config, "RETURN 1 AS ok");
  return body !== null;
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Persist a completed traversal into HydraDB as (:Package)-[:DEPENDS_ON]->(:Package).
 * Nodes carry name/version/downloads; edges carry the declared range. Idempotent
 * MERGEs, batched with low concurrency. Never throws.
 */
export async function hydradbUpsertTraversal(result: TraverseResult): Promise<boolean> {
  const config = loadHydradbConfig();
  if (config.disabled) return false;

  const cypherStatements: string[] = [];
  // Target node with metadata
  cypherStatements.push(
    `MERGE (p:Package {name: "${esc(result.target.name)}"}) ` +
      `SET p.version = "${esc(result.target.version)}", ` +
      `p.downloads = ${Math.round(result.stats.downloads)}, p.scannedAt = timestamp()`
  );
  // Dependency nodes + edges (self-contained statements)
  for (const node of result.nodes) {
    if (node.id === result.target.name) continue;
    cypherStatements.push(
      `MERGE (n:Package {name: "${esc(node.id)}"}) SET n.group = ${node.group}`
    );
  }
  for (const link of result.links) {
    cypherStatements.push(
      `MERGE (a:Package {name: "${esc(link.source)}"}) ` +
        `MERGE (b:Package {name: "${esc(link.target)}"}) ` +
        `MERGE (a)-[:DEPENDS_ON]->(b)`
    );
  }

  // Small concurrency batches — MERGEs are idempotent so order doesn't matter.
  const BATCH = 6;
  let ok = 0;
  for (let i = 0; i < cypherStatements.length; i += BATCH) {
    const batch = cypherStatements.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((q) => postQuery(config, q)));
    ok += results.filter((r) => r !== null).length;
  }
  return ok > 0;
}

/**
 * Transitive reverse dependency closure: which nodes in the HydraDB graph
 * (:Package or :Service) depend on `name`, directly or through up to
 * `maxDepth` hops. This is the "09:00 compromise → which services are
 * exposed" question.
 */
export async function hydradbReverseClosure(
  name: string,
  maxDepth = 3
): Promise<string[]> {
  const config = loadHydradbConfig();
  if (config.disabled) return [];
  const body = await queryAll(
    config,
    `MATCH (p)-[:DEPENDS_ON*1..${maxDepth}]->(c:Package) ` +
      `WHERE c.name = $name RETURN DISTINCT p.name AS name`,
    { name }
  );
  if (!body) return [];
  return extractColumn(body, "name");
}

/**
 * Register an application as a :Service node with DEPENDS_ON edges to its
 * direct dependencies, so reverse closures answer "is YOUR app exposed?".
 * Best-effort; returns false when no node is reachable.
 */
export async function hydradbUpsertService(
  appName: string,
  directDeps: string[]
): Promise<boolean> {
  const config = loadHydradbConfig();
  if (config.disabled) return false;
  const statements: string[] = [
    `MERGE (s:Service {name: "${esc(appName)}"}) ` +
      `SET s.kind = "service", s.scannedAt = timestamp()`,
    ...directDeps.map(
      (dep) =>
        `MERGE (s:Service {name: "${esc(appName)}"}) ` +
        `MERGE (b:Package {name: "${esc(dep)}"}) ` +
        `MERGE (s)-[:DEPENDS_ON]->(b)`
    ),
  ];
  const BATCH = 6;
  let ok = 0;
  for (let i = 0; i < statements.length; i += BATCH) {
    const batch = statements.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((q) => postQuery(config, q)));
    ok += results.filter((r) => r !== null).length;
  }
  return ok > 0;
}

/** Packages + edges currently stored in the HydraDB graph. */
export async function hydradbStats(): Promise<{ packages: number; edges: number } | null> {
  const config = loadHydradbConfig();
  if (config.disabled) return null;
  const pkg = await queryAll(config, "MATCH (p:Package) RETURN count(p) AS packages");
  const edge = await queryAll(config, "MATCH ()-[:DEPENDS_ON]->() RETURN count(*) AS edges");
  if (!pkg || !edge) return null;
  return {
    packages: firstNumber(pkg, "packages") ?? 0,
    edges: firstNumber(edge, "edges") ?? 0,
  };
}

/** Best-effort full status: connectivity + graph size + reverse closure. */
export async function hydradbGraphInfo(target: string): Promise<HydradbGraphInfo> {
  const config = loadHydradbConfig();
  if (config.disabled) {
    return { connected: false, packages: 0, edges: 0, reverse: [], reverseDepth: 3 };
  }
  const [stats, reverse] = await Promise.all([
    hydradbStats().catch(() => null),
    hydradbReverseClosure(target).catch(() => []),
  ]);
  return {
    connected: stats !== null,
    packages: stats?.packages ?? 0,
    edges: stats?.edges ?? 0,
    reverse,
    reverseDepth: 3,
  };
}

/* ------------------------------------------------------------------ */
/*  Defensive response parsing                                          */
/* ------------------------------------------------------------------ */

function cellValue(cell: unknown): unknown {
  if (Array.isArray(cell)) return cell[0];
  if (cell && typeof cell === "object") {
    const c = cell as HydradbCell;
    return c.value ?? c;
  }
  return cell;
}

/**
 * Extract a named column as strings. Handles the typed JSON response
 * ({columns, rows:[[{type,value},...]]}) plus looser shapes defensively.
 */
function extractColumn(body: HydradbQueryResponse, column: string): string[] {
  const columns = body.columns ?? [];
  const idx = columns.indexOf(column);
  const out: string[] = [];
  for (const row of body.rows ?? []) {
    if (Array.isArray(row)) {
      const cell = idx >= 0 ? row[idx] : row[0];
      const v = cellValue(cell);
      if (typeof v === "string") out.push(v);
    } else if (row && typeof row === "object") {
      const v = (row as Record<string, unknown>)[column];
      if (typeof v === "string") out.push(v);
    }
  }
  return out;
}

function firstNumber(body: HydradbQueryResponse, column: string): number | null {
  const columns = body.columns ?? [];
  const idx = columns.indexOf(column);
  for (const row of body.rows ?? []) {
    if (Array.isArray(row)) {
      const v = cellValue(idx >= 0 ? row[idx] : row[0]);
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        const n = Number(v);
        if (!Number.isNaN(n)) return n;
      }
    }
  }
  return null;
}
