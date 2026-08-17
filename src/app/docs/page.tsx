import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity01Icon,
  AlertDiamondIcon,
  ArrowUpRight01Icon,
  CommandLineIcon,
  Database02Icon,
  FingerPrintScanIcon,
  GitBranchIcon,
  Layers01Icon,
  PackageSearchIcon,
  Radar01Icon,
  Search01Icon,
  Shield02Icon,
  Target01Icon,
  Timer01Icon,
  ZapIcon,
} from "hugeicons-react";
import Header from "@/components/Header";
import { BrandWordmark, HydraMark, IconTile } from "@/components/ui";

export const metadata: Metadata = {
  title: "Docs — HydraSentinel",
  description:
    "How HydraSentinel traces the real blast radius of any npm package: live registry traversal, metrics, severity tiers, and the streaming API.",
};

/* ------------------------------------------------------------------ */
/*  Doc building blocks                                                 */
/* ------------------------------------------------------------------ */

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="chip whitespace-nowrap px-3 py-1.5 text-[10px] text-ink-500 sm:text-[11px]">
      {children}
    </span>
  );
}

function Section({
  icon,
  step,
  title,
  children,
}: {
  icon: ReactNode;
  step: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="anim-rise">
      <div className="flex items-center gap-3">
        <IconTile>
          <span className="p-2">{icon}</span>
        </IconTile>
        <div>
          <p className="mono-label">{step}</p>
          <h2 className="font-display text-xl font-bold tracking-tight text-ink-900">{title}</h2>
        </div>
      </div>
      <div className="clay-card mt-4 p-5 sm:p-6">{children}</div>
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-ink-900/10 bg-ink-900 p-5 font-mono text-[12.5px] leading-6 text-sand-200 shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)]">
      {children}
    </pre>
  );
}

function MetricRow({ name, source, meaning }: { name: string; source: string; meaning: string }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="whitespace-nowrap py-3 pr-4 align-top font-mono text-[12.5px] font-semibold text-clay-600">
        {name}
      </td>
      <td className="py-3 pr-4 align-top font-mono text-[11.5px] leading-5 text-ink-500">{source}</td>
      <td className="py-3 align-top text-sm leading-6 text-ink-500">{meaning}</td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function DocsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20">
        {/* Hero */}
        <section className="pt-12 pb-10 sm:pt-16">
          <div className="anim-rise d1 mb-6 inline-flex">
            <Eyebrow>
              <Shield02Icon size={13} className="text-clay-600" />
              DOCUMENTATION
            </Eyebrow>
          </div>
          <div className="anim-rise d2 flex items-start gap-4">
            <IconTile tone="clay">
              <span className="p-2.5 text-[#fff7ee]">
                <HydraMark className="h-9 w-9" />
              </span>
            </IconTile>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
                HydraSentinel docs
              </h1>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-500">
                How HydraSentinel traces the real blast radius of any npm package —
                live registry traversal, what each metric means, and the streaming
                API behind the explorer.
              </p>
            </div>
          </div>
        </section>

        {/* Quick start */}
        <Section icon={<Search01Icon size={18} />} step="quick start" title="Scan a package">
          <ol className="space-y-4">
            {[
              ["Open the explorer", "Everything runs in the browser against the live npm registry — no setup, no keys."],
              ["Type a package name", "e.g. lodash, express, left-pad — or tap a suggested chip and hit Run analysis."],
              ["Watch the traversal", "The console streams each real step as the server resolves metadata, walks the dependency tree, and fetches weekly downloads."],
              ["Read the report", "Weekly downloads, dependency counts, shared maintainers and traversal time, with a severity verdict."],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="font-mono text-lg font-bold text-clay-500">0{i + 1}</span>
                <div>
                  <p className="font-display text-sm font-semibold text-ink-900">{title}</p>
                  <p className="mt-0.5 text-sm leading-6 text-ink-500">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            href="/"
            className="clay-btn mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            Open the explorer
            <ArrowUpRight01Icon size={16} />
          </Link>
        </Section>

        {/* How the scan works */}
        <div className="mt-10 space-y-10">
          <Section icon={<Radar01Icon size={18} />} step="how it works" title="The traversal">
            <ol className="space-y-5">
              {[
                {
                  icon: <Target01Icon size={16} />,
                  title: "Resolve",
                  body: "The target is resolved on registry.npmjs.org — latest version, description, maintainers, and declared dependencies.",
                },
                {
                  icon: <GitBranchIcon size={16} />,
                  title: "Expand",
                  body: "The dependency tree is walked two levels deep, bounded to 46 nodes so the force graph stays renderable. Direct dependency versions are recorded as declared ranges.",
                },
                {
                  icon: <PackageSearchIcon size={16} />,
                  title: "Measure",
                  body: "Weekly downloads are fetched from api.npmjs.org — the blast-radius proxy that works for every package, no matter how popular.",
                },
                {
                  icon: <FingerPrintScanIcon size={16} />,
                  title: "Flag",
                  body: "Maintainers of the expanded direct dependencies are compared with the target's — overlap is a classic supply-chain signal.",
                },
                {
                  icon: <Timer01Icon size={16} />,
                  title: "Time",
                  body: "Every query is measured server-side; the latency you see is the real round-trip to the registry.",
                },
              ].map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="mt-0.5">
                    <IconTile tone={i % 2 ? "moss" : "sand"}>
                      <span className="p-2">{s.icon}</span>
                    </IconTile>
                  </span>
                  <div>
                    <p className="font-display text-sm font-semibold text-ink-900">
                      {i + 1}. {s.title}
                    </p>
                    <p className="mt-0.5 text-sm leading-6 text-ink-500">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {/* Metrics */}
          <Section icon={<Database02Icon size={18} />} step="metrics" title="What the report shows">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    <th className="mono-label py-2 pr-4">metric</th>
                    <th className="mono-label py-2 pr-4">source</th>
                    <th className="mono-label py-2">meaning</th>
                  </tr>
                </thead>
                <tbody>
                  <MetricRow
                    name="weekly downloads"
                    source="api.npmjs.org/downloads/point/last-week"
                    meaning="Blast-radius proxy — how widely the package is pulled in a week."
                  />
                  <MetricRow
                    name="direct dependencies"
                    source="registry metadata dependencies"
                    meaning="Declared dependencies of the resolved version."
                  />
                  <MetricRow
                    name="transitive packages"
                    source="bounded depth-2 expansion"
                    meaning="Sampled transitive closure of the dependency tree."
                  />
                  <MetricRow
                    name="shared maintainers"
                    source="maintainer lists of expanded deps"
                    meaning="Maintainers overlapping between the target and its direct dependencies."
                  />
                  <MetricRow
                    name="traversal time"
                    source="measured server-side"
                    meaning="Latency of the real registry queries."
                  />
                </tbody>
              </table>
            </div>
          </Section>

          {/* Severity */}
          <Section icon={<AlertDiamondIcon size={18} />} step="severity" title="Risk tiers">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "critical",
                  threshold: "≥ 1,000,000 downloads / wk",
                  cls: "bg-gradient-to-b from-[#e07042] to-[#b44824] text-[#fff7ee]",
                },
                {
                  label: "high",
                  threshold: "≥ 100,000 downloads / wk",
                  cls: "bg-gradient-to-b from-[#c2922f] to-[#a67a24] text-[#fff7ee]",
                },
                {
                  label: "moderate",
                  threshold: "< 100,000 downloads / wk",
                  cls: "bg-gradient-to-b from-[#8a7760] to-[#6e5c48] text-[#f7f0e1]",
                },
              ].map((tier) => (
                <div key={tier.label} className={`rounded-2xl p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_18px_-10px_rgba(98,66,32,0.5)] ${tier.cls}`}>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] opacity-80">{tier.label}</p>
                  <p className="mt-1 text-sm font-semibold">{tier.threshold}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-ink-500">
              Tiers are computed from real weekly downloads. The explorer shows{" "}
              <span className="font-mono text-clay-600">COMPROMISED</span> for critical and high
              risk, and <span className="font-mono text-ochre-500">MAPPED</span> for moderate.
            </p>
          </Section>

          {/* HydraDB */}
          <Section icon={<Database02Icon size={18} />} step="graph" title="The HydraDB graph">
            <p className="text-sm leading-6 text-ink-500">
              Every completed scan is persisted into a local HydraDB node as{" "}
              <span className="font-mono text-[12.5px]">(:Package)</span> nodes and{" "}
              <span className="font-mono text-[12.5px]">-[:DEPENDS_ON]-&gt;</span> edges via its
              HTTPS query API. The explorer then answers the brief&rsquo;s headline question —
              <em> which packages depend on this one, transitively?</em> — with a bounded
              reverse closure:
            </p>
            <div className="mt-4">
              <Code>{`MATCH (p:Package)-[:DEPENDS_ON*1..3]->(c:Package)
WHERE c.name = $name
RETURN DISTINCT p.name AS name`}</Code>
            </div>
            <p className="mt-4 text-sm leading-6 text-ink-500">
              Run a node (Docker image or source build — see the README), then seed a real
              slice of the npm graph so closures answer immediately:
            </p>
            <div className="mt-3">
              <Code>{`curl "http://localhost:3000/api/hydradb/seed?packages=express,lodash,react-dom,commander,is-odd,chalk,axios,uuid,moment,debug,minimist,underscore"`}</Code>
            </div>
            <p className="mt-4 text-sm leading-6 text-ink-500">
              Config lives in <span className="font-mono text-[12.5px]">.env.local</span> ({" "}
              <span className="font-mono text-[12.5px]">HYDRADB_URL</span>,{" "}
              <span className="font-mono text-[12.5px]">HYDRADB_TOKEN</span>,{" "}
              <span className="font-mono text-[12.5px]">HYDRADB_GRAPH</span>,{" "}
              <span className="font-mono text-[12.5px]">HYDRADB_CELL</span>). With no node
              reachable the explorer degrades gracefully to live-registry-only scans and
              shows <span className="font-mono text-moss-600">HYDRADB OFFLINE</span>.
            </p>
          </Section>

          {/* API */}
          <Section icon={<CommandLineIcon size={18} />} step="api" title="Streaming API">
            <p className="text-sm leading-6 text-ink-500">
              <span className="font-mono text-[12.5px] font-semibold text-clay-600">GET /api/traverse</span>{" "}
              takes a <span className="font-mono text-[12.5px]">package</span> query parameter and streams{" "}
              newline-delimited JSON. Each line is one of three message types:
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip px-3 py-1.5 text-ink-700">
                <Activity01Icon size={13} className="text-clay-600" /> log — a real traversal step, streamed as it happens
              </span>
              <span className="chip px-3 py-1.5 text-ink-700">
                <ZapIcon size={13} className="text-ochre-500" /> result — final payload: target, graph, stats
              </span>
              <span className="chip px-3 py-1.5 text-ink-700">
                <AlertDiamondIcon size={13} className="text-clay-600" /> error — registry failure
              </span>
            </div>
            <div className="mt-5 space-y-3">
              <Code>{`$ curl -s "http://localhost:3000/api/traverse?package=express"`}</Code>
              <Code>{`{"type":"log","message":"hydradb: resolve \\"express\\" on registry.npmjs.org"}
{"type":"log","message":"hydradb: resolved express@5.2.1 — 28 direct dependencies"}
{"type":"log","message":"hydradb: fetching weekly downloads for express…"}
{"type":"log","message":"hydradb: 109,881,741 downloads last week"}
{"type":"log","message":"hydradb: traversal complete in 899ms — 10 nodes, 9 edges"}
{"type":"result","target":{"name":"express","version":"5.2.1",
  "description":"Fast, unopinionated, minimalist web framework",
  "maintainers":["wesleytodd","jonchurch","ctcpip","ulisesgascon","sheplu"]},
  "nodes":[ …10 nodes… ],"links":[ …9 edges… ],
  "stats":{"downloads":109881741,"directDeps":28,"transitive":3,"sharedMaintainers":0,"timeMs":899}}`}</Code>
            </div>
            <p className="mt-4 text-sm leading-6 text-ink-500">
              The result payload feeds the explorer directly: <span className="font-mono text-[12.5px]">target</span>{" "}
              for the report, <span className="font-mono text-[12.5px]">nodes</span> /{" "}
              <span className="font-mono text-[12.5px]">links</span> for the force graph, and{" "}
              <span className="font-mono text-[12.5px]">stats</span> for the metrics.
            </p>
          </Section>

          {/* Local dev */}
          <Section icon={<Layers01Icon size={18} />} step="development" title="Run it locally">
            <Code>{`npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint`}</Code>
            <p className="mt-4 text-sm leading-6 text-ink-500">
              The API route lives at <span className="font-mono text-[12.5px]">src/app/api/traverse/route.ts</span>{" "}
              and the traversal logic at <span className="font-mono text-[12.5px]">src/lib/registry.ts</span>.
            </p>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-line">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 px-5 py-6 sm:flex-row">
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
