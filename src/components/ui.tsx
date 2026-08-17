import type { ReactNode } from "react";

export function HydraMark({ className = "" }: { className?: string }) {
  // The hydra: five graph-node heads on serpentine necks rising from a central
  // hub — the sentinel eye — watched over by a radar-sweep arc.
  // Strokes inherit currentColor so the mark works on light and dark surfaces.
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      {/* radar sweep */}
      <path
        d="M32 6 A 26 26 0 1 1 6 32"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="1.5 6.5"
        opacity="0.5"
      />
      {/* necks */}
      <g stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" opacity="0.85">
        <path d="M32 38.5 C 32 26 32 20 32 15" />
        <path d="M27.5 41 C 23.5 31 21 25 21 19" />
        <path d="M36.5 41 C 40.5 31 43 25 43 19" />
        <path d="M24.5 44.5 C 17.5 40.5 12.5 35 11 33" />
        <path d="M39.5 44.5 C 46.5 40.5 51.5 35 53 33" />
      </g>
      {/* sentinel eye hub */}
      <circle cx="32" cy="46" r="8.5" fill="currentColor" />
      <circle cx="32" cy="46" r="3.2" fill="#fdf9f1" />
      <circle cx="32" cy="46" r="1.3" fill="currentColor" />
      {/* heads */}
      <g stroke="currentColor" strokeWidth="2" fill="#fdf9f1">
        <circle cx="32" cy="9" r="6" />
        <circle cx="21" cy="13" r="6" />
        <circle cx="43" cy="13" r="6" />
        <circle cx="11" cy="27" r="6" />
        <circle cx="53" cy="27" r="6" />
      </g>
    </svg>
  );
}

export function BrandWordmark({ className = "" }: { className?: string }) {
  // The two-tone lockup: bold ink "Hydra" + medium clay "Sentinel".
  return (
    <span
      className={`whitespace-nowrap font-display font-bold tracking-tight text-ink-900 ${className}`}
    >
      Hydra<span className="font-medium text-clay-600">Sentinel</span>
    </span>
  );
}

export function IconTile({
  children,
  tone = "sand",
}: {
  children: ReactNode;
  tone?: "sand" | "clay" | "moss" | "ink";
}) {
  const tones: Record<string, string> = {
    sand: "bg-gradient-to-b from-[#fdfaf2] to-[#f1e8d5] text-ink-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(70,55,42,0.12),0_6px_14px_-8px_rgba(98,66,32,0.3)]",
    clay: "bg-gradient-to-b from-[#e07042] to-[#b44824] text-[#fff7ee] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_4px_12px_-4px_rgba(178,68,26,0.6)]",
    moss: "bg-gradient-to-b from-[#64804a] to-[#4a672f] text-[#f0f5e8] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_12px_-4px_rgba(58,84,34,0.55)]",
    ink: "bg-gradient-to-b from-[#46372a] to-[#241b12] text-sand-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_12px_-4px_rgba(36,27,18,0.6)]",
  };
  return (
    <span className={`inline-flex items-center justify-center rounded-2xl ${tones[tone]}`}>{children}</span>
  );
}
