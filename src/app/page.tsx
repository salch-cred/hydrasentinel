"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity01Icon,
  AlertDiamondIcon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Database02Icon,
  Download04Icon,
  FingerPrintScanIcon,
  GitBranchIcon,
  Layers01Icon,
  PackageIcon,
  PackageSearchIcon,
  Radar01Icon,
  RefreshIcon,
  Search01Icon,
  Shield02Icon,
  ShieldEnergyIcon,
  Target01Icon,
  Timer01Icon,
  ZapIcon,
} from "hugeicons-react";
import type { TraverseResult } from "@/lib/registry";
import type { IncidentReport } from "@/lib/incident";
import { severityOf } from "@/lib/severity";
import { saveReport } from "@/lib/reports";
import DependencyGraph from "@/components/DependencyGraph";
import Header from "@/components/Header";
import { BrandWordmark, HydraMark, IconTile } from "@/components/ui";
import { CountUp, Reveal } from "@/components/motion";

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                     */
/* ------------------------------------------------------------------ */

type Phase = "idle" | "scanning" | "done" | "error";

type StreamMsg =
  | { type: "log"; message: string }
  | ({ type: "result" } & TraverseResult)
  | {
      type: "hydradb";
      connected: boolean;
      packages: number;
      edges: number;
      reverse: string[];
      reverseDepth: number;
    }
  | { type: "error"; message: string };

type HydradbInfo = {
  connected: boolean;
  packages: number;
  edges: number;
  reverse: string[];
  reverseDepth: number;
};

type IncidentState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; data: IncidentReport }
  | { status: "error"; error: string };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const QUICK_PICKS = ["react-dom", "left-pad", "lodash", "is-odd", "commander"];


const MONITORED = [
  "lodash",
  "react-dom",
  "express",
  "commander",
  "is-odd",
  "chalk",
  "axios",
  "uuid",
  "moment",
  "debug",
  "minimist",
  "underscore",
];


/* ------------------------------------------------------------------ */
/*  Small building blocks                                               */
/* ------------------------------------------------------------------ */

function StatTile({
  icon,
  label,
  value,
  suffix = "",
  delta,
  tone = "sand",
  delay,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  suffix?: string;
  delta: string;
  tone?: "sand" | "clay" | "moss";
  delay: number;
}) {
  return (
    <Reveal delay={delay}>
      <div className="clay-card clay-lift h-full p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <IconTile tone={tone}>
            <span className="p-2 sm:p-2.5">{icon}</span>
          </IconTile>
          <span className="chip whitespace-nowrap px-2 py-1 text-moss-600">{delta}</span>
        </div>
        <div className="mt-4 font-display text-2xl font-bold tracking-tight text-ink-900 sm:mt-5 sm:text-3xl">
          <CountUp to={value} suffix={suffix} />
        </div>
        <div className="mono-label mt-1.5">{label}</div>
      </div>
    </Reveal>
  );
}

function IncidentPanel({ report }: { report: IncidentReport }) {
  const timeline = report.timeline.slice(-6);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="mono-label text-clay-600">INCIDENT SIMULATION</p>
        <span className="chip px-2.5 py-1 text-ink-700">
          <Timer01Icon size={13} className="text-clay-600" />
          window · {report.windowHours}h after publish
        </span>
      </div>

      <p className="mt-3 font-display text-base font-bold leading-snug text-ink-900">
        <span className="font-mono text-clay-600">
          {report.target}@{report.badVersion}
        </span>{" "}
        was live {fmtDate(report.windowStart)} → {fmtDate(report.windowEnd)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`chip px-3 py-1.5 ${
            report.exposedCount > 0 ? "text-moss-600" : "text-ink-400"
          }`}
        >
          <ShieldEnergyIcon size={13} />
          {report.hydradbConnected
            ? report.exposedCount > 0
              ? `${report.exposedCount} known depend${report.exposedCount === 1 ? "ent" : "ents"} exposed in window`
              : "0 dependents in graph"
            : "connect HydraDB to see exposure"}
        </span>
        {report.exposed.slice(0, 8).map((name) => (
          <span key={name} className="chip px-2.5 py-1 text-ink-700">
            {name}
          </span>
        ))}
        {report.exposed.length > 8 && (
          <span className="mono-label text-ink-400">+{report.exposed.length - 8} more</span>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-sand-100/60 p-3">
        <p className="mono-label">real publish timeline · last {timeline.length} versions</p>
        <ul className="mt-2 space-y-1">
          {timeline.map((p) => (
            <li key={p.version} className="flex items-baseline justify-between gap-3 text-[13px]">
              <span
                className={`font-mono ${
                  p.version === report.badVersion ? "font-bold text-clay-600" : "text-ink-700"
                }`}
              >
                {p.version}
              </span>
              <span className="text-ink-400">{fmtDate(p.publishedAt)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function Home() {
  const [packageName, setPackageName] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [results, setResults] = useState<TraverseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);
  const [telemetry, setTelemetry] = useState({ resolved: 0, downloads: 0, lastMs: 0, risky: 0 });
  const [hydradbInfo, setHydradbInfo] = useState<HydradbInfo | null>(null);
  const [incident, setIncident] = useState<IncidentState>({ status: "idle" });

  const runAnalysis = async (name: string) => {
    const target = name.trim();
    if (!target || phase === "scanning") return;
    setPackageName(target);
    setPhase("scanning");
    setResults(null);
    setError(null);
    setLogLines([]);
    setHydradbInfo(null);
    setIncident({ status: "idle" });
    setRunId((n) => n + 1);

    try {
      const res = await fetch(`/api/traverse?package=${encodeURIComponent(target)}`, {
        cache: "no-store",
      });
      if (!res.ok || !res.body) throw new Error(`traversal endpoint answered ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          if (!raw.trim()) continue;
          let msg: StreamMsg;
          try {
            msg = JSON.parse(raw) as StreamMsg;
          } catch {
            continue;
          }
          if (msg.type === "log") {
            setLogLines((prev) => [...prev, msg.message]);
          } else if (msg.type === "result") {
            setResults(msg);
            setTelemetry((t) => ({
              resolved: t.resolved + msg.nodes.length,
              downloads: t.downloads + msg.stats.downloads,
              lastMs: msg.stats.timeMs,
              risky: t.risky + (severityOf(msg.stats.downloads) !== "moderate" ? 1 : 0),
            }));
            saveReport({
              name: msg.target.name,
              version: msg.target.version,
              downloads: msg.stats.downloads,
              directDeps: msg.stats.directDeps,
              transitive: msg.stats.transitive,
              sharedMaintainers: msg.stats.sharedMaintainers,
              timeMs: msg.stats.timeMs,
              at: Date.now(),
            });
            setPhase("done");
          } else if (msg.type === "hydradb") {
            setHydradbInfo(msg);
          } else if (msg.type === "error") {
            setError(msg.message);
            setPhase("error");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error during traversal");
      setPhase("error");
    }
  };

  const simulateIncident = async () => {
    if (!results || incident.status === "loading") return;
    setIncident({ status: "loading" });
    try {
      const res = await fetch(
        `/api/incident?package=${encodeURIComponent(results.target.name)}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as {
        ok: boolean;
        report?: IncidentReport;
        error?: string;
      };
      if (!json.ok || !json.report) throw new Error(json.error ?? "incident simulation failed");
      setIncident({ status: "done", data: json.report });
    } catch (err) {
      setIncident({
        status: "error",
        error: err instanceof Error ? err.message : "simulation failed",
      });
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runAnalysis(packageName);
  };

  const scanning = phase === "scanning";
  const severity = results ? severityOf(results.stats.downloads) : "moderate";

  return (
    <div className="flex min-h-screen flex-col">
      {/* ---------------------------------------------------------- */}
      {/* Header                                                      */}
      {/* ---------------------------------------------------------- */}
      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20">
        {/* -------------------------------------------------------- */}
        {/* Hero + search                                             */}
        {/* -------------------------------------------------------- */}
        <section className="pt-10 pb-10 text-center sm:pt-14 sm:pb-12 md:pt-20">
          <div className="anim-rise d1 mx-auto mb-6 inline-flex max-w-full">
            <span className="chip whitespace-nowrap px-3 py-1.5 text-[10px] text-ink-500 sm:px-3.5 sm:text-[11px]">
              <Activity01Icon size={13} className="text-clay-600" />
              <span className="sm:hidden">NPM REGISTRY · LIVE</span>
              <span className="hidden sm:inline">NPM REGISTRY · LIVE TRAVERSAL</span>
            </span>
          </div>

          <h1 className="anim-rise d2 mx-auto max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink-900 md:text-6xl">
            One compromised package.{" "}
            <span className="font-serif italic font-normal text-clay-600">Every</span> service it touches.
          </h1>

          <p className="anim-rise d3 mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-500 md:text-lg">
            Trace the real blast radius of any npm package — resolve its dependency
            tree, measure its weekly downloads, and flag maintainers shared across the
            chain.
          </p>

          <form onSubmit={onSubmit} className="anim-rise d4 mx-auto mt-8 max-w-2xl sm:mt-9">
            <div className="clay-field flex items-center gap-2.5 py-2 pl-4 pr-2 sm:gap-3 sm:pl-5">
              <Search01Icon size={19} className="shrink-0 text-ink-400 sm:size-5" />
              <input
                type="text"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="Search a package…"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-ink-900 placeholder:text-ink-400"
                aria-label="Package name"
              />
              <button
                type="submit"
                disabled={scanning || !packageName.trim()}
                className="clay-btn flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm sm:gap-2 sm:px-5"
              >
                {scanning ? (
                  <>
                    <Radar01Icon size={17} className="spin-slow" />
                    <span className="hidden sm:inline">Scanning</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">Run analysis</span>
                    <ArrowRight01Icon size={17} className="transition-transform duration-300" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="anim-rise d5 mt-4 flex flex-wrap items-center justify-center gap-1.5 sm:mt-5 sm:gap-2">
            <span className="mono-label mr-1">try</span>
            {QUICK_PICKS.map((pkg) => (
              <button
                key={pkg}
                type="button"
                onClick={() => runAnalysis(pkg)}
                disabled={scanning}
                className="chip px-3 py-1.5 text-ink-700 transition-all duration-300 hover:-translate-y-0.5 hover:border-clay-500/50 hover:text-clay-600 disabled:opacity-60"
              >
                <PackageIcon size={12} />
                {pkg}
              </button>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/* Telemetry                                                  */}
        {/* -------------------------------------------------------- */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile
            delay={0}
            icon={<Database02Icon size={20} />}
            label="packages resolved"
            value={telemetry.resolved}
            delta="this session"
            tone="sand"
          />
          <StatTile
            delay={90}
            icon={<PackageSearchIcon size={20} />}
            label="downloads sampled"
            value={telemetry.downloads}
            delta="this session"
            tone="moss"
          />
          <StatTile
            delay={180}
            icon={<Timer01Icon size={20} />}
            label="last traversal"
            value={telemetry.lastMs}
            suffix=" ms"
            delta="real-time"
          />
          <StatTile
            delay={270}
            icon={<AlertDiamondIcon size={20} />}
            label="high-risk scans"
            value={telemetry.risky}
            delta="flagged"
            tone="clay"
          />
        </section>

        {/* -------------------------------------------------------- */}
        {/* Workspace: graph + console + report                        */}
        {/* -------------------------------------------------------- */}
        <section id="explorer" className="mt-8 scroll-mt-24">
          <Reveal delay={120}>
            <div className="clay-card overflow-hidden">
              {/* Workspace header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5 sm:py-4">
                <div className="flex items-center gap-3">
                  <IconTile>
                    <span className="p-2">
                      <Radar01Icon size={18} />
                    </span>
                  </IconTile>
                  <div>
                    <h2 className="font-display text-base font-bold tracking-tight text-ink-900">
                      Blast radius explorer
                    </h2>
                    <p className="mono-label mt-0.5 hidden md:block">live npm registry traversal</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Legend */}
                  <div className="hidden items-center gap-2 md:flex">
                    <span className="chip px-2.5 py-1 text-clay-600">
                      <Target01Icon size={13} /> target
                    </span>
                    <span className="chip px-2.5 py-1 text-ink-500">
                      <PackageIcon size={13} /> packages
                    </span>
                    <span className="chip px-2.5 py-1 text-moss-600">
                      <Layers01Icon size={13} /> transitive
                    </span>
                  </div>

                  {/* Status badge */}
                  {phase === "idle" && (
                    <span className="chip whitespace-nowrap px-3 py-1.5 text-ink-400">STANDBY</span>
                  )}
                  {scanning && (
                    <span className="chip whitespace-nowrap px-3 py-1.5 text-clay-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-clay-500 text-clay-500" />
                      SCANNING
                    </span>
                  )}
                  {phase === "done" && results && (
                    <span
                      className={`chip whitespace-nowrap px-3 py-1.5 ${
                        severity === "moderate"
                          ? "text-ochre-500"
                          : "severity-pulse border-clay-500/40 text-clay-600"
                      }`}
                    >
                      {severity === "moderate" ? <Radar01Icon size={13} /> : <AlertDiamondIcon size={13} />}
                      {severity === "moderate" ? "MAPPED" : "COMPROMISED"}
                    </span>
                  )}
                  {phase === "done" && hydradbInfo && (
                    <span
                      className={`chip whitespace-nowrap px-3 py-1.5 ${
                        hydradbInfo.connected ? "text-moss-600" : "text-ink-400"
                      }`}
                    >
                      {hydradbInfo.connected ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-moss-500 text-moss-500" />
                          HYDRADB ONLINE
                        </>
                      ) : (
                        "HYDRADB OFFLINE"
                      )}
                    </span>
                  )}
                  {phase === "error" && (
                    <span className="chip whitespace-nowrap px-3 py-1.5 text-clay-600">
                      <AlertDiamondIcon size={13} />
                      ERROR
                    </span>
                  )}
                </div>
              </div>

              {/* Workspace body */}
              <div className="relative">
                {phase === "idle" && (
                  <div className="flex min-h-[360px] flex-col items-center justify-center px-4 py-12 text-center sm:min-h-[440px] sm:px-6 sm:py-16">
                    <div className="relative mb-8 h-36 w-36 sm:h-44 sm:w-44">
                      <div className="radar-ring" style={{ animationDelay: "0s" }} />
                      <div className="radar-ring" style={{ animationDelay: "1.1s" }} />
                      <div className="radar-ring" style={{ animationDelay: "2.2s" }} />
                      <div className="absolute inset-5 rounded-full border border-line-strong" />
                      <div className="radar-sweep absolute inset-0" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="clay-btn-ghost floaty rounded-3xl p-4">
                          <ShieldEnergyIcon size={34} className="text-clay-600" />
                        </span>
                      </div>
                    </div>
                    <p className="mono-label">awaiting target package</p>
                    <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500">
                      Run an analysis or tap a suggested package. HydraSentinel resolves
                      the package on the live npm registry and maps its dependency tree
                      and real weekly downloads.
                    </p>
                  </div>
                )}

                {phase === "error" && (
                  <div className="flex min-h-[360px] flex-col items-center justify-center px-4 py-12 text-center sm:min-h-[440px]">
                    <span className="clay-btn-ghost rounded-2xl p-4">
                      <AlertDiamondIcon size={30} className="text-clay-600" />
                    </span>
                    <p className="mono-label mt-5">traversal failed</p>
                    <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500">{error}</p>
                    <button
                      type="button"
                      onClick={() => runAnalysis(packageName)}
                      className="clay-btn-ghost mt-5 px-5 py-2.5 text-sm"
                    >
                      Try again
                    </button>
                  </div>
                )}

                {scanning && (
                  <div className="min-h-[360px] px-4 py-8 sm:min-h-[440px] sm:px-6 sm:py-10">
                    <div className="mx-auto max-w-2xl">
                      <div className="flex items-center gap-3">
                        <Radar01Icon size={20} className="spin-slow text-clay-600" />
                        <div className="flex-1">
                          <div className="flex items-baseline justify-between">
                            <span className="font-display text-sm font-semibold text-ink-900">
                              Traversing live registry graph
                            </span>
                            <span className="mono-label">{logLines.length} lines</span>
                          </div>
                          <div className="scan-bar mt-2.5 h-1.5" />
                        </div>
                      </div>

                      <div className="mt-6 rounded-2xl border border-ink-900/10 bg-ink-900 p-5 font-mono text-[12.5px] leading-7 shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)]">
                        {logLines.map((line, i) => (
                          <div key={i} className="log-line flex gap-2 text-sand-200/85">
                            <span className="select-none text-clay-300">▸</span>
                            <span>{line}</span>
                          </div>
                        ))}
                        <div className="log-line flex items-center gap-2 text-sand-200/60">
                          <span className="select-none text-clay-300">▸</span>
                          <span>hydradb: traversing…</span>
                          <span className="caret" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {phase === "done" && results && (
                  <div className="anim-rise d1">
                    <div className="relative h-[380px] w-full sm:h-[480px]">
                      <DependencyGraph
                        key={`${results.target.name}-${runId}`}
                        data={{ nodes: results.nodes, links: results.links }}
                      />
                    </div>

                    {/* Report strip */}
                    <div className="border-t border-line bg-gradient-to-b from-[#fdfaf2] to-[#f6eedf] px-4 py-4 sm:px-6 sm:py-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                          <span
                            className={`rounded-2xl p-3 text-[#fff7ee] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_8px_18px_-8px_rgba(178,68,26,0.7)] ${
                              severity === "moderate"
                                ? "bg-gradient-to-b from-[#8a7760] to-[#6e5c48]"
                                : "severity-pulse bg-gradient-to-b from-[#e07042] to-[#b44824]"
                            }`}
                          >
                            <AlertDiamondIcon size={22} />
                          </span>
                          <div>
                            <div className="font-display text-lg font-bold leading-tight text-ink-900">
                              {severity === "moderate" ? "Blast radius mapped" : "Compromise detected"} —{" "}
                              {results.stats.downloads.toLocaleString("en-US")} weekly downloads
                            </div>
                            <p className="mt-0.5 text-sm text-ink-500">
                              <span className="font-mono text-clay-600">
                                {results.target.name}@{results.target.version}
                              </span>{" "}
                              is pulled {results.stats.downloads.toLocaleString("en-US")} times a week
                              across {results.stats.directDeps} direct dependenc{results.stats.directDeps === 1 ? "y" : "ies"}.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-stretch gap-2.5 max-sm:w-full">
                          <button type="button" className="clay-btn-ghost flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm sm:flex-none">
                            <Download04Icon size={16} className="text-clay-600" />
                            Report
                          </button>
                          <button type="button" className="clay-btn flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm sm:flex-none">
                            Investigate
                            <ArrowUpRight01Icon size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 sm:mt-5 sm:gap-2.5">
                        <span className="chip px-3 py-1.5 text-ink-700">
                          <ZapIcon size={13} className="text-ochre-500" />
                          {results.stats.downloads.toLocaleString("en-US")} downloads / wk
                        </span>
                        <span className="chip px-3 py-1.5 text-ink-700">
                          <GitBranchIcon size={13} className="text-clay-600" />
                          {results.stats.directDeps} direct dependenc{results.stats.directDeps === 1 ? "y" : "ies"}
                        </span>
                        <span className="chip px-3 py-1.5 text-ink-700">
                          <Layers01Icon size={13} className="text-clay-600" />
                          {results.stats.transitive} transitive packages
                        </span>
                        <span className="chip px-3 py-1.5 text-ink-700">
                          <FingerPrintScanIcon size={13} className="text-moss-600" />
                          {results.stats.sharedMaintainers} shared maintainer{results.stats.sharedMaintainers === 1 ? "" : "s"}
                        </span>
                        {results.target.typosquats && results.target.typosquats.length > 0 && (
                          <span
                            className="chip px-3 py-1.5 text-clay-600"
                            title={`Possible typosquats: ${results.target.typosquats
                              .map((t) => `${t.name} (${t.distance} edit${t.distance === 1 ? "" : "s"})`)
                              .join(", ")}`}
                          >
                            <AlertDiamondIcon size={13} />
                            {results.target.typosquats.length} possible typosquat{results.target.typosquats.length === 1 ? "" : "s"}
                          </span>
                        )}
                        <span className="chip px-3 py-1.5 text-ink-700">
                          <Timer01Icon size={13} className="text-clay-600" />
                          traversal {results.stats.timeMs}ms
                        </span>
                        {hydradbInfo?.connected && (
                          <>
                            <span className="chip px-3 py-1.5 text-ink-700">
                              <Target01Icon size={13} className="text-clay-600" />
                              HydraDB graph · {hydradbInfo.packages} pkgs · {hydradbInfo.edges} edges
                            </span>
                            <span
                              className={`chip px-3 py-1.5 ${
                                hydradbInfo.reverse.length > 0 ? "text-moss-600" : "text-ink-400"
                              }`}
                              title={`Packages in the HydraDB graph that depend on ${results.target.name} transitively (depth ≤ ${hydradbInfo.reverseDepth})`}
                            >
                              <ShieldEnergyIcon size={13} />
                              {hydradbInfo.reverse.length > 0
                                ? `${hydradbInfo.reverse.length} known depend${hydradbInfo.reverse.length === 1 ? "ent" : "ents"} exposed`
                                : "0 dependents in graph"}
                            </span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={simulateIncident}
                          disabled={incident.status === "loading"}
                          className="chip px-3 py-1.5 text-clay-600 transition-all duration-300 hover:-translate-y-0.5 hover:border-clay-500/50 disabled:opacity-60"
                        >
                          {incident.status === "loading" ? (
                            <Radar01Icon size={13} className="spin-slow" />
                          ) : (
                            <AlertDiamondIcon size={13} />
                          )}
                          {incident.status === "loading" ? "simulating…" : "Simulate incident"}
                        </button>
                        <button
                          type="button"
                          onClick={() => runAnalysis(results.target.name)}
                          className="chip ml-auto px-3 py-1.5 text-clay-600 transition-all duration-300 hover:-translate-y-0.5 hover:border-clay-500/50"
                        >
                          <RefreshIcon size={13} />
                          re-run
                        </button>
                      </div>

                      {incident.status !== "idle" && (
                        <div className="anim-rise mt-4 rounded-2xl border border-clay-500/30 bg-sand-100/70 p-4 sm:mt-5 sm:p-5">
                          {incident.status === "loading" && (
                            <p className="mono-label flex items-center gap-2">
                              <Radar01Icon size={14} className="spin-slow text-clay-600" />
                              simulating compromise…
                            </p>
                          )}
                          {incident.status === "error" && (
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm text-ink-500">
                                incident simulation failed — {incident.error}
                              </p>
                              <button
                                type="button"
                                onClick={simulateIncident}
                                className="clay-btn-ghost shrink-0 rounded-xl px-3 py-1.5 text-xs"
                              >
                                retry
                              </button>
                            </div>
                          )}
                          {incident.status === "done" && incident.data && (
                            <IncidentPanel report={incident.data} />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Reveal>
        </section>

        {/* -------------------------------------------------------- */}
        {/* How it works — small footnote row                          */}
        {/* -------------------------------------------------------- */}
        <section className="mt-6 grid gap-3 sm:mt-8 sm:gap-4 md:grid-cols-3">
          {[
            {
              icon: <Search01Icon size={17} />,
              step: "01",
              title: "Index",
              body: "Resolve any npm package and its dependency tree straight from the live registry.",
            },
            {
              icon: <GitBranchIcon size={17} />,
              step: "02",
              title: "Traverse",
              body: "A bounded graph walk expands the transitive closure, recording versions and shared maintainers as it goes.",
            },
            {
              icon: <Shield02Icon size={17} />,
              step: "03",
              title: "Expose",
              body: "Real dependent counts and shared maintainers surface the blast radius as an interactive map.",
            },
          ].map((item, i) => (
            <Reveal key={item.step} delay={i * 90}>
              <div className="clay-card clay-lift h-full p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <IconTile>
                    <span className="p-2 sm:p-2.5">{item.icon}</span>
                  </IconTile>
                  <span className="font-mono text-2xl font-bold text-line-strong/60">{item.step}</span>
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-ink-900">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </section>
      </main>

      {/* ---------------------------------------------------------- */}
      {/* Footer ticker + footer                                       */}
      {/* ---------------------------------------------------------- */}
      <footer className="mt-auto">
        <div className="border-y border-line bg-sand-200/60 py-2.5">
          <div className="flex overflow-hidden">
            <div className="ticker flex shrink-0 items-center gap-8 whitespace-nowrap pr-8 font-mono text-[11px] tracking-[0.14em] text-ink-400 uppercase">
              {[...MONITORED, ...MONITORED].map((pkg, i) => (
                <span key={i} className="flex items-center gap-8">
                  {pkg}
                  <span className="text-clay-500">
                    <HydraMark className="h-3 w-3" />
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="text-clay-600">
              <HydraMark className="h-5 w-5" />
            </span>
            <BrandWordmark className="text-base" />
          </div>
          <p className="text-xs text-ink-400">
            Supply-chain blast radius · live npm registry traversal
          </p>
          <div className="flex items-center gap-5">
            <a href="#" className="nav-link text-xs font-medium">
              Status
            </a>
            <Link href="/docs" className="nav-link text-xs font-medium">
              Docs
            </Link>
            <a href="#" className="nav-link text-xs font-medium">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
