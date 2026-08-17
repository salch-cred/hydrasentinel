/**
 * "Your services" — paste a package.json, and HydraSentinel resolves it against
 * the live registry: real resolved versions, the transitive tree, the riskiest
 * dependency, and the exposure paths if that dependency were compromised while
 * live. The app is registered into the HydraDB graph as a :Service so any scan
 * can answer "is YOUR app exposed?".
 */

import { maxSatisfying } from "@/lib/semver";
import { fetchPublishTimeline } from "@/lib/incident";
import { hydradbUpsertService } from "@/lib/hydradb";

export interface YourServiceNode {
  id: string;
  group: 1 | 2 | 3;
  val: number;
  name: string;
  version: string;
  range: string;
  downloads: number;
}

export interface YourServiceLink {
  source: string;
  target: string;
}

export interface ExposurePath {
  path: string[];
}

export interface YourServicesReport {
  ok: boolean;
  app: {
    name: string;
    directDeps: number;
    treeNodes: number;
    edges: number;
    nodes: YourServiceNode[];
    links: YourServiceLink[];
  };
  riskiest?: {
    name: string;
    version: string;
    downloads: number;
    windowStart?: string;
    windowEnd?: string;
  };
  exposedPaths: ExposurePath[];
  registeredInHydradb: boolean;
  error?: string;
}

interface AbbrevPackument {
  versions?: Record<string, { dependencies?: Record<string, string> }>;
}

const MAX_TREE_NODES = 60;
const MAX_DIRECT = 40;
const TREE_DEPTH = 3;

async function fetchJson<T>(url: string, timeoutMs = 9000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchVersions(name: string): Promise<string[]> {
  const pkg = await fetchJson<AbbrevPackument>(
    `https://registry.npmjs.org/${encodeURIComponent(name)}`,
    8000
  );
  return pkg?.versions ? Object.keys(pkg.versions) : [];
}

async function fetchDownloads(name: string): Promise<number> {
  const dl = await fetchJson<{ downloads?: number }>(
    `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`,
    8000
  );
  return typeof dl?.downloads === "number" ? dl.downloads : 0;
}

function parseManifest(raw: string): { name: string; deps: Record<string, string> } {
  const parsed = JSON.parse(raw) as {
    name?: string;
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  };
  const deps: Record<string, string> = {
    ...(parsed.optionalDependencies ?? {}),
    ...(parsed.dependencies ?? {}),
  };
  return {
    name: typeof parsed.name === "string" && parsed.name ? parsed.name : "your-app",
    deps,
  };
}

/**
 * Resolve a pasted manifest into the real tree. Group: 1 = direct, 2 = transitive
 * depth 2, 3 = depth 3. Downloads fetched per unique package (bounded).
 */
export async function analyzeYourServices(rawManifest: string): Promise<YourServicesReport> {
  let appName: string;
  let deps: Record<string, string>;
  try {
    ({ name: appName, deps } = parseManifest(rawManifest));
  } catch {
    return {
      ok: false,
      app: { name: "your-app", directDeps: 0, treeNodes: 0, edges: 0, nodes: [], links: [] },
      exposedPaths: [],
      registeredInHydradb: false,
      error: "could not parse package.json — is it valid JSON?",
    };
  }

  const nodes: YourServiceNode[] = [];
  const links: YourServiceLink[] = [];
  const seen = new Set<string>();
  const nodesByName = new Map<string, YourServiceNode>();

  const pushNode = (n: YourServiceNode): boolean => {
    if (seen.has(n.id) || nodes.length >= MAX_TREE_NODES) return false;
    seen.add(n.id);
    nodes.push(n);
    nodesByName.set(n.id, n);
    return true;
  };

  const directEntries = Object.entries(deps).slice(0, MAX_DIRECT);
  const directNames = directEntries.map(([name]) => name);

  // Resolve direct deps: versions + max-satisfying + downloads (batched).
  const resolvedDirect = new Map<
    string,
    { version: string | null; range: string; downloads: number }
  >();
  const BATCH = 8;
  for (let i = 0; i < directEntries.length; i += BATCH) {
    const batch = directEntries.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async ([name, range]) => {
        const versions = await fetchVersions(name);
        const version = versions.length > 0 ? maxSatisfying(versions, range) : null;
        const downloads = await fetchDownloads(name);
        return { name, range, version, downloads };
      })
    );
    for (const r of results) {
      resolvedDirect.set(r.name, {
        version: r.version,
        range: r.range,
        downloads: r.downloads,
      });
      if (r.version) pushNode({ id: r.name, group: 1, val: 14, name: r.name, version: r.version, range: r.range, downloads: r.downloads });
    }
  }
  for (const name of resolvedDirect.keys()) {
    if (nodesByName.has(name)) links.push({ source: appName, target: name });
  }

  // BFS the tree two more levels using resolved versions' dependencies.
  for (let depth = 2; depth <= TREE_DEPTH; depth++) {
    const frontier = nodes.filter((n) => n.group === depth - 1);
    for (const parent of frontier) {
      const pkg = await fetchJson<AbbrevPackument>(
        `https://registry.npmjs.org/${encodeURIComponent(parent.id)}`,
        8000
      );
      const sub = pkg?.versions?.[parent.version]?.dependencies ?? {};
      for (const [subName, subRange] of Object.entries(sub).slice(0, 6)) {
        if (!pushNode({ id: subName, group: depth as 1 | 2 | 3, val: 5, name: subName, version: "", range: subRange, downloads: 0 })) continue;
        links.push({ source: parent.id, target: subName });
      }
    }
  }

  // Downloads for transitive nodes we didn't fetch yet (bounded).
  const missingDownloads = nodes.filter((n) => n.group > 1);
  for (let i = 0; i < missingDownloads.length; i += BATCH) {
    const batch = missingDownloads.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((n) => fetchDownloads(n.id)));
    results.forEach((downloads, idx) => {
      const n = batch[idx];
      n.downloads = downloads;
      if (!n.version) {
        n.version = "resolved-in-scan";
      }
    });
  }

  // Register the app as a :Service in HydraDB (best-effort).
  const registered = await hydradbUpsertService(
    appName,
    directNames.filter((n) => nodesByName.has(n))
  );

  // Riskiest = highest-downloads DIRECT dep (resolved version + real window).
  const riskiest =
    nodes
      .filter((n) => n.group === 1 && n.version && n.version !== "resolved-in-scan")
      .sort((a, b) => b.downloads - a.downloads)[0] ??
    [...nodes].sort((a, b) => b.downloads - a.downloads)[0];
  let riskiestInfo: YourServicesReport["riskiest"];
  if (riskiest && riskiest.version && riskiest.version !== "resolved-in-scan") {
    const timeline = await fetchPublishTimeline(riskiest.id);
    const point = timeline.find((p) => p.version === riskiest.version);
    if (point) {
      const start = new Date(point.publishedAt);
      riskiestInfo = {
        name: riskiest.id,
        version: riskiest.version,
        downloads: riskiest.downloads,
        windowStart: start.toISOString(),
        windowEnd: new Date(start.getTime() + 6 * 60 * 60 * 1000).toISOString(),
      };
    } else {
      riskiestInfo = {
        name: riskiest.id,
        version: riskiest.version,
        downloads: riskiest.downloads,
      };
    }
  }

  // Exposure paths: direct deps → compromised node (BFS, bounded).
  const exposedPaths: ExposurePath[] = [];
  if (riskiest) {
    const target = riskiest.id;
    const targetSet = new Set(nodes.map((n) => n.id));
    if (targetSet.has(target)) {
      const reverseAdj = new Map<string, string[]>();
      for (const l of links) {
        if (!reverseAdj.has(l.target)) reverseAdj.set(l.target, []);
        reverseAdj.get(l.target)!.push(l.source);
      }
      const queue: { node: string; path: string[] }[] = [{ node: target, path: [target] }];
      const visitedPaths = new Set<string>();
      while (queue.length > 0 && exposedPaths.length < 8) {
        const { node, path } = queue.shift()!;
        for (const up of reverseAdj.get(node) ?? []) {
          if (path.includes(up)) continue;
          const nextPath = [up, ...path];
          if (up === appName) {
            exposedPaths.push({ path: nextPath });
            continue;
          }
          const key = nextPath.join(">");
          if (visitedPaths.has(key)) continue;
          visitedPaths.add(key);
          if (nextPath.length <= 4) queue.push({ node: up, path: nextPath });
        }
      }
      if (exposedPaths.length === 0 && directNames.includes(target)) {
        exposedPaths.push({ path: [appName, target] });
      }
    }
  }

  return {
    ok: true,
    app: {
      name: appName,
      directDeps: directNames.length,
      treeNodes: nodes.length,
      edges: links.length,
      nodes,
      links,
    },
    riskiest: riskiestInfo,
    exposedPaths,
    registeredInHydradb: registered,
  };
}
