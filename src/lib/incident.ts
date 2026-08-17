/**
 * Incident simulation — the brief's "09:00 compromise → which services by
 * 09:06" scenario made concrete with real registry data.
 *
 * For a target package it:
 *   1. resolves the current state via the real traversal (registry.ts)
 *   2. fetches the full packument's `time` map for the real publish timeline
 *   3. picks the resolved version as the compromised one and computes the
 *      window it was live (publishedAt → +windowHours)
 *   4. asks HydraDB for the transitive reverse closure — the known packages
 *      that depended on it during that window
 */

import { traversePackage, type TraverseResult } from "@/lib/registry";
import {
  hydradbPing,
  hydradbReverseClosure,
  hydradbUpsertTraversal,
  loadHydradbConfig,
} from "@/lib/hydradb";

export interface VersionPoint {
  version: string;
  publishedAt: string;
}

export interface IncidentReport {
  target: string;
  resolvedVersion: string;
  badVersion: string;
  windowStart: string;
  windowEnd: string;
  windowHours: number;
  timeline: VersionPoint[];
  exposed: string[];
  exposedCount: number;
  hydradbConnected: boolean;
  traversal: TraverseResult;
}

const MAX_PACKUMENT_BYTES = 30 * 1024 * 1024;
const TIMELINE_CAP = 15;

interface PackumentTime {
  time?: Record<string, string>;
  modified?: string;
}

async function fetchPublishTimeline(name: string): Promise<VersionPoint[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_PACKUMENT_BYTES) return [];
    const packument = (await res.json()) as PackumentTime;
    const time = packument.time ?? {};
    const points: VersionPoint[] = [];
    for (const [version, publishedAt] of Object.entries(time)) {
      if (version === "created" || version === "modified") continue;
      if (typeof publishedAt !== "string") continue;
      points.push({ version, publishedAt });
    }
    points.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    return points.slice(-TIMELINE_CAP);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build an incident report. `windowHours` is how long the compromised version
 * stays live after publish (default 6h — the "09:00 → 09:06" window).
 */
export async function buildIncidentReport(
  name: string,
  windowHours = 6
): Promise<IncidentReport> {
  const traversal = await traversePackage(name, () => {});
  // Persist this scan into HydraDB first so the closure sees it.
  await hydradbUpsertTraversal(traversal);

  const timeline = await fetchPublishTimeline(name);
  const resolvedVersion = traversal.target.version;
  const point = timeline.find((p) => p.version === resolvedVersion);
  const publishedAt = point?.publishedAt ?? new Date().toISOString();
  const start = new Date(publishedAt);
  const end = new Date(start.getTime() + windowHours * 60 * 60 * 1000);

  const config = loadHydradbConfig();
  const connected = config.disabled ? false : await hydradbPing().catch(() => false);
  const exposed = connected ? await hydradbReverseClosure(name).catch(() => []) : [];

  return {
    target: name,
    resolvedVersion,
    badVersion: resolvedVersion,
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    windowHours,
    timeline,
    exposed,
    exposedCount: exposed.length,
    hydradbConnected: connected,
    traversal,
  };
}
