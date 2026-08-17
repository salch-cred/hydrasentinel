/**
 * Real npm-registry traversal for HydraSentinel.
 *
 * Given a package name it:
 *   1. resolves the latest version + metadata from registry.npmjs.org
 *   2. counts real dependents via the registry search API (`dependencies:<name>`)
 *   3. BFS-walks the dependency tree (bounded) and records shared maintainers
 *   4. returns a renderable graph + stats and a human-readable traversal log
 */

export interface TraverseNode {
  id: string;
  group: 1 | 2 | 3;
  val: number;
  name: string;
  version?: string;
}

export interface TraverseLink {
  source: string;
  target: string;
}

export interface TraverseStats {
  downloads: number;
  directDeps: number;
  transitive: number;
  sharedMaintainers: number;
  timeMs: number;
}

export interface TraverseResult {
  target: { name: string; version: string; description?: string; maintainers: string[] };
  nodes: TraverseNode[];
  links: TraverseLink[];
  stats: TraverseStats;
}

interface RegistryPackageMeta {
  name?: string;
  version?: string;
  description?: string;
  maintainers?: { name?: string }[];
  dependencies?: Record<string, string>;
}

interface DownloadsPoint {
  downloads?: number;
}

const REGISTRY = "https://registry.npmjs.org";
const MAX_NODES = 46; // keep the force graph renderable
const DIRECT_DEP_BUDGET = 6; // direct deps to include in the graph
const EXPAND_DIRECT = 4; // direct deps whose metadata we fetch (depth-2 expansion + maintainers)
const TRANSITIVE_PER_DEP = 3;

async function fetchJson<T>(url: string, timeoutMs = 9000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`registry answered ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    if (ctrl.signal.aborted) throw new Error("registry timed out");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function traversePackage(
  name: string,
  log: (message: string) => void
): Promise<TraverseResult> {
  const t0 = Date.now();
  const nodes: TraverseNode[] = [];
  const links: TraverseLink[] = [];
  const seen = new Set<string>();

  const pushNode = (n: TraverseNode): boolean => {
    if (seen.has(n.id) || nodes.length >= MAX_NODES) return false;
    seen.add(n.id);
    nodes.push(n);
    return true;
  };

  // 1 — resolve the target
  log(`hydradb: resolve "${name}" on registry.npmjs.org`);
  const meta = await fetchJson<RegistryPackageMeta>(`${REGISTRY}/${encodeURIComponent(name)}/latest`);
  const version: string = typeof meta.version === "string" ? meta.version : "latest";
  const description =
    typeof meta.description === "string" ? meta.description.slice(0, 140) : "";
  const maintainers = (meta.maintainers ?? [])
    .map((m) => m.name)
    .filter((m): m is string => typeof m === "string");
  const deps = meta.dependencies ?? {};
  const directCount = Object.keys(deps).length;
  log(`hydradb: resolved ${name}@${version} — ${directCount} direct dependenc${directCount === 1 ? "y" : "ies"}`);
  pushNode({ id: name, group: 1, val: 20, name, version });

  // 3 — direct dependencies (depth 1)
  const directEntries = Object.entries(deps).slice(0, DIRECT_DEP_BUDGET);
  for (const [depName, range] of directEntries) {
    if (!pushNode({ id: depName, group: 2, val: 10, name: depName, version: range })) break;
    links.push({ source: name, target: depName });
  }
  log(`hydradb: ${links.length} direct edge${links.length === 1 ? "" : "s"} added`);

  // 2 + 4 — weekly downloads and depth-2 expansion run concurrently
  const downloadsPromise = (async () => {
    log(`hydradb: fetching weekly downloads for ${name}…`);
    try {
      const dl = await fetchJson<DownloadsPoint>(
        `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`
      );
      return typeof dl.downloads === "number" ? dl.downloads : 0;
    } catch {
      log(`hydradb: warn — downloads API unavailable`);
      return 0;
    }
  })();

  const expansionPromise = (async () => {
    let transitive = 0;
    const shared = new Set<string>();
    await Promise.all(
      directEntries.slice(0, EXPAND_DIRECT).map(async ([depName]) => {
        try {
          const depMeta = await fetchJson<RegistryPackageMeta>(
            `${REGISTRY}/${encodeURIComponent(depName)}/latest`
          );
          for (const m of depMeta.maintainers ?? []) {
            if (m.name && maintainers.includes(m.name)) shared.add(m.name);
          }
          const sub = Object.keys(depMeta.dependencies ?? {}).slice(0, TRANSITIVE_PER_DEP);
          for (const subName of sub) {
            if (!pushNode({ id: subName, group: 3, val: 5, name: subName })) break;
            links.push({ source: depName, target: subName });
            transitive += 1;
          }
          log(`hydradb: edge ${depName} → ${sub.join(", ") || "∅"} (depth 2)`);
        } catch {
          log(`hydradb: warn — could not expand ${depName}`);
        }
      })
    );
    return { transitive, shared: Array.from(shared) };
  })();

  const [downloads, { transitive, shared }] = await Promise.all([
    downloadsPromise,
    expansionPromise,
  ]);
  log(`hydradb: ${downloads.toLocaleString("en-US")} downloads last week`);

  const timeMs = Date.now() - t0;
  log(`hydradb: traversal complete in ${timeMs}ms — ${nodes.length} nodes, ${links.length} edges`);

  return {
    target: { name, version, description, maintainers },
    nodes,
    links,
    stats: {
      downloads,
      directDeps: directCount,
      transitive,
      sharedMaintainers: shared.length,
      timeMs,
    },
  };
}
