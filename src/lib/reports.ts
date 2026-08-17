export interface StoredReport {
  name: string;
  version: string;
  downloads: number;
  directDeps: number;
  transitive: number;
  sharedMaintainers: number;
  timeMs: number;
  at: number;
}

const KEY = "hydrasentinel:reports";

function readRaw(): StoredReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredReport[]) : [];
  } catch {
    return [];
  }
}

/* Tiny external store so the Reports page can subscribe without effects. */
const listeners = new Set<() => void>();
let cache: StoredReport[] | null = null;

function emit(): void {
  cache = null;
  for (const listener of listeners) listener();
}

export function getReportsSnapshot(): StoredReport[] {
  if (cache === null) cache = readRaw();
  return cache;
}

export function subscribeReports(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function saveReport(report: StoredReport): void {
  if (typeof window === "undefined") return;
  try {
    const reports = readRaw().filter(
      (r) => r.name !== report.name || r.version !== report.version
    );
    reports.unshift(report);
    window.localStorage.setItem(KEY, JSON.stringify(reports.slice(0, 50)));
  } catch {
    // storage full or unavailable — skip persisting, the scan still succeeded
  }
  emit();
}

export function clearReports(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  emit();
}
