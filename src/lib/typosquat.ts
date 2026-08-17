/**
 * Typosquat detection — names that sit close enough to a popular package to
 * be a malicious lookalike (the brief's explicit "are there likely typosquat
 * packages nearby?"). Uses Damerau–Levenshtein edit distance (typos include
 * transpositions, e.g. "lodahs") against a curated list of high-download
 * packages.
 */

export interface Typosquat {
  name: string;
  distance: number;
  /** distance 1 = typo-grade, 2 = close lookalike */
  severity: "typo" | "close";
}

const POPULAR: string[] = [
  "react", "react-dom", "next", "vue", "angular", "jquery", "lodash",
  "underscore", "express", "axios", "chalk", "commander", "uuid", "moment",
  "dayjs", "date-fns", "debug", "minimist", "yargs", "dotenv", "semver",
  "glob", "rimraf", "mkdirp", "fs-extra", "path-to-regexp", "prop-types",
  "classnames", "typescript", "eslint", "prettier", "webpack", "jest",
  "mocha", "sinon", "chai", "ramda", "rxjs", "core-js", "nanoid", "zod",
  "yup", "formik", "redux", "zustand", "ioredis", "mongoose", "knex", "pg",
  "request", "superagent", "bluebird", "async", "inherits", "through",
  "is-number", "is-odd", "left-pad", "negotiator", "send", "mime", "fresh",
  "etag", "vary", "accepts", "http-errors", "statuses", "qs", "body-parser",
  "cookie", "cookie-parser", "cors", "helmet", "morgan", "winston", "pino",
  "node-fetch", "got", "cheerio", "puppeteer", "socket.io", "ws", "ajv",
  "svelte", "tailwindcss", "bootstrap", "handlebars", "ejs", "pug",
  "markdown-it", "highlight.js", "luxon", "i18next", "moment-timezone",
  "tslib", "source-map", "acorn", "browserslist", "caniuse-lite",
];

/** Damerau–Levenshtein edit distance (insert/delete/substitute/transpose). */
export function editDistance(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const d = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[n][m];
}

/**
 * Find popular packages within `maxDistance` edits of `name`.
 * Scoped names (@scope/pkg) are compared by their unscoped part.
 */
export function findTyposquats(
  name: string,
  maxDistance = 2
): Typosquat[] {
  const bare = name.includes("/") ? name.split("/").pop() ?? name : name;
  const lower = bare.toLowerCase().trim();
  if (!lower) return [];

  const hits: Typosquat[] = [];
  for (const candidate of POPULAR) {
    if (candidate === lower) continue;
    const dist = editDistance(lower, candidate);
    if (dist <= maxDistance) {
      hits.push({
        name: candidate,
        distance: dist,
        severity: dist === 1 ? "typo" : "close",
      });
    }
  }
  return hits.sort((a, b) => a.distance - b.distance).slice(0, 5);
}
