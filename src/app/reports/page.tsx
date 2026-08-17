"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AlertDiamondIcon,
  ArrowUpRight01Icon,
  Clock01Icon,
  Delete01Icon,
  Download04Icon,
  FingerPrintScanIcon,
  GitBranchIcon,
  Layers01Icon,
  Radar01Icon,
  RefreshIcon,
  Timer01Icon,
} from "hugeicons-react";
import Header from "@/components/Header";
import { BrandWordmark, HydraMark, IconTile } from "@/components/ui";
import { severityOf, type Severity } from "@/lib/severity";
import {
  clearReports,
  getReportsSnapshot,
  subscribeReports,
  type StoredReport,
} from "@/lib/reports";

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

function fmtDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(at: number): string {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const compromised = severity !== "moderate";
  return (
    <span
      className={`chip whitespace-nowrap px-2.5 py-1 ${
        compromised ? "severity-pulse border-clay-500/40 text-clay-600" : "text-ochre-500"
      }`}
    >
      {compromised ? <AlertDiamondIcon size={13} /> : <Radar01Icon size={13} />}
      {compromised ? "COMPROMISED" : "MAPPED"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

const EMPTY_REPORTS: StoredReport[] = [];

const getEmptySnapshot = () => EMPTY_REPORTS;

export default function ReportsPage() {
  const reports = useSyncExternalStore(subscribeReports, getReportsSnapshot, getEmptySnapshot);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pb-20">
        {/* Hero */}
        <section className="pt-12 pb-10 sm:pt-16">
          <div className="anim-rise d1 mb-6 inline-flex">
            <span className="chip whitespace-nowrap px-3 py-1.5 text-[10px] text-ink-500 sm:text-[11px]">
              <Clock01Icon size={13} className="text-clay-600" />
              SCAN HISTORY
            </span>
          </div>
          <div className="anim-rise d2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
                Reports
              </h1>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-500">
                Every scan you run in the explorer is stored in your browser — the real
                verdicts, metrics, and traversal times.
              </p>
            </div>
            <Link
              href="/#explorer"
              className="clay-btn inline-flex shrink-0 items-center gap-2 px-5 py-2.5 text-sm"
            >
              <RefreshIcon size={16} />
              Run new scan
            </Link>
          </div>
        </section>

        {reports.length === 0 ? (
          <section className="anim-rise">
            <div className="clay-card flex min-h-[320px] flex-col items-center justify-center px-6 py-14 text-center">
              <span className="clay-btn-ghost floaty rounded-3xl p-4">
                <Radar01Icon size={30} className="text-clay-600" />
              </span>
              <p className="mono-label mt-5">no scans yet</p>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500">
                Run your first analysis in the explorer and its report will show up here —
                stored locally in this browser.
              </p>
              <Link
                href="/#explorer"
                className="clay-btn mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm"
              >
                Open the explorer
                <ArrowUpRight01Icon size={16} />
              </Link>
            </div>
          </section>
        ) : (
          <section className="anim-rise">
            <div className="clay-card overflow-hidden">
              {/* Header row */}
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
                <p className="mono-label">
                  {reports.length} report{reports.length === 1 ? "" : "s"} · stored locally
                </p>
                <button
                  type="button"
                  onClick={() => clearReports()}
                  className="clay-btn-ghost flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs text-clay-600"
                >
                  <Delete01Icon size={14} />
                  Clear all
                </button>
              </div>

              {/* Rows */}
              <div className="divide-y divide-line">
                {reports.map((r) => {
                  const severity = severityOf(r.downloads);
                  return (
                    <div
                      key={`${r.name}@${r.version}-${r.at}`}
                      className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-sand-200/40 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                    >
                      {/* Identity */}
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <IconTile tone={severity === "moderate" ? "sand" : "clay"}>
                          <span className="p-2">
                            {severity === "moderate" ? (
                              <Radar01Icon size={16} />
                            ) : (
                              <AlertDiamondIcon size={16} className="text-[#fff7ee]" />
                            )}
                          </span>
                        </IconTile>
                        <div className="min-w-0">
                          <p className="truncate font-mono text-[13.5px] font-semibold text-ink-900">
                            {r.name}
                            <span className="text-ink-400">@{r.version}</span>
                          </p>
                          <p className="mono-label mt-0.5 text-[10.5px]">{timeAgo(r.at)}</p>
                        </div>
                      </div>

                      {/* Verdict */}
                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        <SeverityBadge severity={severity} />
                        <span className="chip px-2.5 py-1 text-ink-700">
                          <Download04Icon size={13} className="text-clay-600" />
                          {fmtDownloads(r.downloads)}/wk
                        </span>
                        <span className="chip px-2.5 py-1 text-ink-700">
                          <GitBranchIcon size={13} className="text-clay-600" />
                          {r.directDeps} dir
                        </span>
                        <span className="chip px-2.5 py-1 text-ink-700">
                          <Layers01Icon size={13} className="text-clay-600" />
                          {r.transitive} trans
                        </span>
                        <span className="chip px-2.5 py-1 text-ink-700">
                          <FingerPrintScanIcon size={13} className="text-moss-600" />
                          {r.sharedMaintainers} shared
                        </span>
                        <span className="chip px-2.5 py-1 text-ink-700">
                          <Timer01Icon size={13} className="text-clay-600" />
                          {r.timeMs}ms
                        </span>
                        <Link
                          href="/#explorer"
                          aria-label={`Re-scan ${r.name}`}
                          className="clay-btn-ghost flex items-center rounded-xl p-2 text-clay-600"
                        >
                          <RefreshIcon size={15} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-line">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 px-5 py-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="text-clay-600">
              <HydraMark className="h-5 w-5" />
            </span>
            <BrandWordmark className="text-base" />
          </div>
          <p className="text-xs text-ink-400">Supply-chain blast radius · live npm registry traversal</p>
          <div className="flex items-center gap-5">
            <Link href="/" className="nav-link text-xs font-medium">
              Explorer
            </Link>
            <Link href="/docs" className="nav-link text-xs font-medium">
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
