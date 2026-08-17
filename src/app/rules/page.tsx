import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity01Icon,
  AlertDiamondIcon,
  ArrowUpRight01Icon,
  Database02Icon,
  FingerPrintScanIcon,
  GitBranchIcon,
  Layers01Icon,
  LockKeyIcon,
  PackageSearchIcon,
  Shield02Icon,
  Target01Icon,
  ZapIcon,
} from "hugeicons-react";
import Header from "@/components/Header";
import { BrandWordmark, HydraMark, IconTile } from "@/components/ui";

export const metadata: Metadata = {
  title: "Rules — HydraSentinel",
  description:
    "How HydraSentinel decides severity: risk tiers, the signals it flags, and the guardrails that bound each traversal.",
};

/* ------------------------------------------------------------------ */
/*  Building blocks                                                     */
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

const TIERS = [
  {
    label: "critical",
    threshold: "≥ 1,000,000",
    badge: "COMPROMISED",
    body: "A package this widely pulled is a single-point-of-failure across the ecosystem — a compromise propagates to thousands of applications within hours.",
    cls: "bg-gradient-to-b from-[#e07042] to-[#b44824] text-[#fff7ee]",
  },
  {
    label: "high",
    threshold: "≥ 100,000",
    badge: "COMPROMISED",
    body: "Substantial blast radius. Compromise reaches significant production surface and deserves immediate triage.",
    cls: "bg-gradient-to-b from-[#c2922f] to-[#a67a24] text-[#fff7ee]",
  },
  {
    label: "moderate",
    threshold: "< 100,000",
    badge: "MAPPED",
    body: "Real but contained exposure. The dependency map is logged and monitored rather than treated as an active incident.",
    cls: "bg-gradient-to-b from-[#8a7760] to-[#6e5c48] text-[#f7f0e1]",
  },
];

const SIGNALS = [
  {
    icon: <PackageSearchIcon size={16} />,
    name: "weekly downloads",
    why: "The primary severity signal. Sourced from the official api.npmjs.org downloads API, it measures how widely the package is pulled — its real blast radius.",
  },
  {
    icon: <FingerPrintScanIcon size={16} />,
    name: "shared maintainers",
    why: "When a maintainer of the target also maintains its direct dependencies, one compromised account can reach through the whole chain. Overlap is flagged as a supply-chain signal.",
  },
  {
    icon: <GitBranchIcon size={16} />,
    name: "dependency breadth",
    why: "Many direct dependencies mean more surface to vet, more upstream trust to extend, and more places a malicious change can hide. Breadth is logged, not scored.",
  },
];

const GUARDRAILS = [
  {
    name: "depth",
    value: "2 levels",
    body: "The graph expands two levels deep — target → direct dependencies → their dependencies.",
  },
  {
    name: "node budget",
    value: "46 nodes",
    body: "Traversal stops adding nodes past the budget so the force graph always stays renderable.",
  },
  {
    name: "direct dep budget",
    value: "6",
    body: "Only the first six declared direct dependencies are drawn as edges.",
  },
  {
    name: "depth-2 expansion",
    value: "4",
    body: "Metadata for the first four direct deps is fetched to compute shared maintainers.",
  },
  {
    name: "transitive sample",
    value: "3 / dep",
    body: "Each expanded direct dependency contributes up to three transitive children.",
  },
  {
    name: "timeout",
    value: "9s / query",
    body: "Every registry request aborts after nine seconds; failures surface as explicit warnings.",
  },
];

export default function RulesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20">
        {/* Hero */}
        <section className="pt-12 pb-10 sm:pt-16">
          <div className="anim-rise d1 mb-6 inline-flex">
            <Eyebrow>
              <LockKeyIcon size={13} className="text-clay-600" />
              RISK RULES
            </Eyebrow>
          </div>
          <div className="anim-rise d2">
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
              How HydraSentinel decides{" "}
              <span className="font-serif italic font-normal text-clay-600">risk</span>
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-500">
              Every verdict is computed from live registry data — no static scorecards,
              no heuristics on stale metadata. These are the exact rules the explorer applies.
            </p>
          </div>
        </section>

        <div className="space-y-10">
          {/* Severity tiers */}
          <Section icon={<AlertDiamondIcon size={18} />} step="01 · severity" title="Risk tiers">
            <div className="grid gap-3 sm:grid-cols-3">
              {TIERS.map((tier) => (
                <div
                  key={tier.label}
                  className={`flex flex-col rounded-2xl p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_18px_-10px_rgba(98,66,32,0.5)] ${tier.cls}`}
                >
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] opacity-80">
                    {tier.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold">{tier.threshold}</p>
                  <p className="mono-label mt-1 text-[10px] opacity-90">downloads / wk</p>
                  <p className="mt-3 text-[13px] leading-5 opacity-95">{tier.body}</p>
                  <span
                    className={`mt-4 self-start rounded-full px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] ${
                      tier.badge === "COMPROMISED"
                        ? "bg-[#fff7ee]/20 text-[#fff7ee]"
                        : "bg-[#f7f0e1]/20 text-[#f7f0e1]"
                    }`}
                  >
                    {tier.badge}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-ink-500">
              The badge is computed from real weekly downloads:{" "}
              <span className="font-mono text-clay-600">COMPROMISED</span> at critical and high
              risk, <span className="font-mono text-ochre-500">MAPPED</span> at moderate.
            </p>
          </Section>

          {/* Signals */}
          <Section icon={<Activity01Icon size={18} />} step="02 · signals" title="What gets flagged">
            <div className="space-y-5">
              {SIGNALS.map((s) => (
                <div key={s.name} className="flex gap-3">
                  <span className="mt-0.5">
                    <IconTile>
                      <span className="p-2 text-clay-600">{s.icon}</span>
                    </IconTile>
                  </span>
                  <div>
                    <p className="font-display text-sm font-semibold text-ink-900">{s.name}</p>
                    <p className="mt-0.5 text-sm leading-6 text-ink-500">{s.why}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Guardrails */}
          <Section icon={<Database02Icon size={18} />} step="03 · bounds" title="Traversal guardrails">
            <p className="text-sm leading-6 text-ink-500">
              Real traversal, bounded so the explorer stays fast and the graph stays readable.
              These limits are enforced in <span className="font-mono text-[12.5px]">src/lib/registry.ts</span>:
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {GUARDRAILS.map((g) => (
                <div key={g.name} className="rounded-2xl border border-line bg-sand-100/60 p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="mono-label">{g.name}</p>
                    <p className="font-mono text-sm font-bold text-clay-600">{g.value}</p>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-5 text-ink-500">{g.body}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Anatomy of a verdict */}
          <Section icon={<Target01Icon size={18} />} step="04 · verdict" title="From data to verdict">
            <ol className="space-y-5">
              {[
                {
                  icon: <Target01Icon size={16} />,
                  title: "Resolve the target",
                  body: "Latest version, description, maintainers and declared dependencies come straight from registry.npmjs.org.",
                },
                {
                  icon: <Layers01Icon size={16} />,
                  title: "Map the tree",
                  body: "The bounded depth-2 walk records direct edges, transitive children, and maintainer overlap.",
                },
                {
                  icon: <ZapIcon size={16} />,
                  title: "Measure the blast radius",
                  body: "Real weekly downloads from the official API decide the tier — critical, high, or moderate.",
                },
                {
                  icon: <AlertDiamondIcon size={16} />,
                  title: "Render the verdict",
                  body: "COMPROMISED or MAPPED, with the report strip showing every metric that fed the decision.",
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

          {/* CTA */}
          <section className="anim-rise">
            <div className="clay-card clay-lift flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex items-center gap-3">
                <IconTile tone="clay">
                  <span className="p-2.5 text-[#fff7ee]">
                    <Shield02Icon size={20} />
                  </span>
                </IconTile>
                <div>
                  <p className="font-display text-base font-bold text-ink-900">
                    See the rules applied live
                  </p>
                  <p className="text-sm text-ink-500">
                    Every scan in the explorer runs these exact rules on real registry data.
                  </p>
                </div>
              </div>
              <Link
                href="/#explorer"
                className="clay-btn inline-flex shrink-0 items-center gap-2 px-5 py-2.5 text-sm"
              >
                Open the explorer
                <ArrowUpRight01Icon size={16} />
              </Link>
            </div>
          </section>
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
