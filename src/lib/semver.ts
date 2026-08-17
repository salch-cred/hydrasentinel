/**
 * Minimal semver range resolution — enough to resolve real npm package.json
 * ranges (^, ~, >=/<=/</>, x-ranges, hyphens, ||) against a real version list.
 * No dependencies; prereleases are ignored unless the range mentions one.
 */

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  pre: string[];
}

const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export function parseVersion(raw: string): ParsedVersion | null {
  const m = raw.trim().match(VERSION_RE);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ? m[4].split(".") : [],
  };
}

/** 1.2.3-alpha.1 → 1.2.3-alpha.1 ; returns -1/0/1 (numeric-aware prerelease). */
function comparePre(a: string[], b: string[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xn = /^\d+$/.test(x) ? Number(x) : NaN;
    const yn = /^\d+$/.test(y) ? Number(y) : NaN;
    if (!Number.isNaN(xn) && !Number.isNaN(yn)) {
      if (xn !== yn) return xn < yn ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return a < b ? -1 : a > b ? 1 : 0;
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
  if (pa.pre.length === 0 && pb.pre.length === 0) return 0;
  if (pa.pre.length === 0) return 1; // release > prerelease
  if (pb.pre.length === 0) return -1;
  return comparePre(pa.pre, pb.pre);
}

export function isPrerelease(version: string): boolean {
  return parseVersion(version)?.pre.length ? true : false;
}

interface Comparator {
  op: "=" | ">" | ">=" | "<" | "<=";
  version: ParsedVersion;
}

function comparatorMatches(c: Comparator, v: ParsedVersion): boolean {
  // cmp = compareVersions(v, c): -1 when v < c, 0 when equal, 1 when v > c.
  const cmp = (() => {
    if (v.major !== c.version.major) return v.major < c.version.major ? -1 : 1;
    if (v.minor !== c.version.minor) return v.minor < c.version.minor ? -1 : 1;
    if (v.patch !== c.version.patch) return v.patch < c.version.patch ? -1 : 1;
    if (v.pre.length === 0 && c.version.pre.length === 0) return 0;
    if (v.pre.length === 0) return 1; // release > prerelease
    if (c.version.pre.length === 0) return -1;
    return comparePre(v.pre, c.version.pre);
  })();
  switch (c.op) {
    case "=":
      return cmp === 0;
    case ">":
      return cmp > 0;
    case ">=":
      return cmp >= 0;
    case "<":
      return cmp < 0;
    case "<=":
      return cmp <= 0;
  }
}

/** Turn a comparator token like "^1.2.3", "~1.2", "1.2.x", ">=1.0.0 <2" into comparators. */
function tokenToComparators(token: string): Comparator[] {
  const t = token.trim();
  if (!t || t === "*" || t === "latest") return [{ op: ">=", version: { major: 0, minor: 0, patch: 0, pre: [] } }];

  const opMatch = t.match(/^(>=|<=|>|<|=)\s*(.+)$/);
  if (opMatch) {
    const base = expandPartial(opMatch[2]);
    const op = opMatch[1] === "=" ? "=" : (opMatch[1] as Comparator["op"]);
    const v = parseVersion(base);
    if (!v) return [];
    // x-range with >/< is unsupported-ish; treat as exact-ish bounds
    return [{ op, version: v }];
  }

  if (t.startsWith("^")) {
    const base = expandPartial(t.slice(1));
    const v = parseVersion(base);
    if (!v) return [];
    if (v.major > 0) {
      return [
        { op: ">=", version: v },
        { op: "<", version: { major: v.major + 1, minor: 0, patch: 0, pre: [] } },
      ];
    }
    if (v.minor > 0) {
      return [
        { op: ">=", version: v },
        { op: "<", version: { major: 0, minor: v.minor + 1, patch: 0, pre: [] } },
      ];
    }
    return [
      { op: ">=", version: v },
      { op: "<", version: { major: 0, minor: 0, patch: v.patch + 1, pre: [] } },
    ];
  }

  if (t.startsWith("~")) {
    const base = expandPartial(t.slice(1));
    const v = parseVersion(base);
    if (!v) return [];
    return [
      { op: ">=", version: v },
      { op: "<", version: { major: v.major, minor: v.minor + 1, patch: 0, pre: [] } },
    ];
  }

  // hyphen range: 1.2.3 - 2.0.0
  const hyphen = t.match(/^(\S+)\s+-\s+(\S+)$/);
  if (hyphen) {
    const from = parseVersion(expandPartial(hyphen[1]));
    const to = parseVersion(expandPartial(hyphen[2]));
    if (!from || !to) return [];
    return [
      { op: ">=", version: from },
      { op: "<=", version: to },
    ];
  }

  const exact = parseVersion(expandPartial(t));
  if (exact) return [{ op: "=", version: exact }];
  return [];
}

/** "1.2.x" → "1.2.0", "1.x" → "1.0.0", "1" → "1.0.0". */
function expandPartial(s: string): string {
  const parts = s.split(".");
  const nums = parts.map((p) => (p === "x" || p === "X" || p === "*" ? "" : p));
  if (nums.length === 1 && nums[0] !== "") return `${nums[0]}.0.0`;
  if (nums.length === 2 && nums[1] === "") return `${nums[0]}.0.0`;
  if (nums.length === 2 && nums[1] !== "") return `${nums[0]}.${nums[1]}.0`;
  if (nums.length >= 3 && nums[2] === "") return `${nums[0]}.${nums[1]}.0`;
  return s;
}

function versionMatchesSet(version: ParsedVersion, comparators: Comparator[]): boolean {
  if (version.pre.length > 0 && !comparators.some((c) => c.version.pre.length > 0)) {
    return false; // ignore prereleases unless the range mentions one
  }
  return comparators.every((c) => comparatorMatches(c, version));
}

/** Does `version` satisfy `range`? */
export function satisfies(version: string, range: string): boolean {
  const v = parseVersion(version);
  if (!v) return false;
  const alternatives = range.split("||").map((alt) => {
    const tokens = alt.split(/\s+/).filter(Boolean);
    return tokens.flatMap((t) => tokenToComparators(t));
  });
  return alternatives.some((comparators) =>
    comparators.length > 0 ? versionMatchesSet(v, comparators) : false
  );
}

/** Highest version in `versions` that satisfies `range`. */
export function maxSatisfying(versions: string[], range: string): string | null {
  const clean = range.trim() || "*";
  let best: string | null = null;
  for (const v of versions) {
    if (satisfies(v, clean)) {
      if (best === null || compareVersions(v, best) > 0) best = v;
    }
  }
  return best;
}
