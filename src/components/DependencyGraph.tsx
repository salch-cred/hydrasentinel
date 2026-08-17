"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

// ForceGraph2D must be imported dynamically with ssr disabled
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export interface GraphNode {
  id: string;
  group: number;
  val: number;
  name: string;
  version?: string;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/* Palette — mirrors the clay design system */
const NODE_THEME: Record<number, { fill: string; dark: string; glow: string }> = {
  1: { fill: "#d25b2f", dark: "#b44824", glow: "rgba(210,91,47,0.28)" }, // target
  2: { fill: "#8a7760", dark: "#6e5c48", glow: "rgba(110,92,72,0.22)" }, // direct dep
  3: { fill: "#cbb99b", dark: "#a9895a", glow: "rgba(169,137,90,0.18)" }, // deep dep
  4: { fill: "#64804a", dark: "#4a672f", glow: "rgba(100,128,74,0.25)" }, // internal service
};

const radius = (node: GraphNode) => 3 + (node.val ?? 5) * 0.45;

export default function DependencyGraph({ data }: { data: GraphData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 480 });
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 h-full w-full">
      <ForceGraph2D
        width={dimensions.width}
        height={dimensions.height}
        graphData={data}
        backgroundColor="#f5eedf"
        nodeRelSize={5}
        nodeLabel="name"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onNodeHover={(node: any) => setHovered(node?.id ?? null)}
        nodeCanvasObjectMode={() => "replace" as const}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          // The sim hasn't placed this node yet — nothing to draw
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
          const theme = NODE_THEME[node.group as number] ?? NODE_THEME[3];
          const r = radius(node as GraphNode);
          const now = performance.now();

          // Soft glow halo
          const halo = ctx.createRadialGradient(node.x, node.y, r * 0.4, node.x, node.y, r * 2.4);
          halo.addColorStop(0, theme.glow);
          halo.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 2.4, 0, 2 * Math.PI);
          ctx.fill();

          // Pulsing ring around the target
          if (node.group === 1) {
            const ringR = r + 7 + (Math.sin(now / 320) + 1) * 3;
            ctx.strokeStyle = "rgba(210,91,47,0.55)";
            ctx.lineWidth = 1.6 / globalScale;
            ctx.setLineDash([6 / globalScale, 5 / globalScale]);
            ctx.beginPath();
            ctx.arc(node.x, node.y, ringR, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Clay body with vertical light
          const grad = ctx.createLinearGradient(node.x, node.y - r, node.x, node.y + r);
          grad.addColorStop(0, theme.fill);
          grad.addColorStop(1, theme.dark);
          ctx.fillStyle = grad;
          ctx.strokeStyle = "rgba(255,255,255,0.45)";
          ctx.lineWidth = 1.4 / globalScale;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();

          // Top-left specular highlight (clay sheen)
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.beginPath();
          ctx.arc(node.x - r * 0.35, node.y - r * 0.35, r * 0.28, 0, 2 * Math.PI);
          ctx.fill();

          // Hover ring
          if (hovered === node.id) {
            ctx.strokeStyle = "rgba(36,27,18,0.7)";
            ctx.lineWidth = 1.8 / globalScale;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 3.5 / globalScale, 0, 2 * Math.PI);
            ctx.stroke();
          }

          // Labels — skip deep deps unless hovered to avoid clutter
          const showLabel =
            node.group !== 3 || hovered === node.id || (node.group === 1 && !hovered);
          if (showLabel) {
            const size = node.group === 1 ? 12 : 10.5;
            ctx.font = `${node.group === 1 ? 600 : 500} ${size / globalScale}px "Geist Mono", ui-monospace, monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            if (node.group === 1) {
              ctx.fillStyle = "rgba(180,72,36,1)";
              ctx.fillText(node.name, node.x, node.y + r + 8 / globalScale);
            } else {
              ctx.fillStyle = hovered === node.id ? "rgba(36,27,18,0.95)" : "rgba(70,55,42,0.85)";
              ctx.fillText(node.name, node.x, node.y + r + 6 / globalScale);
            }
          }
        }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
          const r = radius(node as GraphNode) + 3;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkColor={() => "rgba(70,55,42,0.22)"}
        linkWidth={1.1}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.006}
        linkDirectionalParticleColor={() => "#e07042"}
        d3AlphaDecay={0.018}
        d3VelocityDecay={0.3}
      />
    </div>
  );
}
