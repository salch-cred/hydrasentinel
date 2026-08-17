"use client";

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// ForceGraph2D must be imported dynamically with ssr disabled
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface Node {
  id: string;
  group: number;
  val: number;
  name: string;
}

interface Link {
  source: string;
  target: string;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

export default function DependencyGraph({ targetPackage }: { targetPackage: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [data, setData] = useState<GraphData | null>(null);

  useEffect(() => {
    // Responsive resize
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
    }

    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Generate real-looking graph data simulating HydraDB graph traversal
    const generateGraph = () => {
      const nodes: Node[] = [
        { id: targetPackage, group: 1, val: 20, name: targetPackage },
      ];
      const links: Link[] = [];

      // Direct dependencies (Layer 1)
      const layer1 = ['express', 'lodash', 'chalk', 'commander'];
      layer1.forEach((pkg, i) => {
        nodes.push({ id: pkg, group: 2, val: 10, name: pkg });
        links.push({ source: targetPackage, target: pkg });
        
        // Deep dependencies (Layer 2)
        for(let j=0; j < 3; j++) {
          const deepPkg = `${pkg}-dep-${j}`;
          nodes.push({ id: deepPkg, group: 3, val: 5, name: deepPkg });
          links.push({ source: pkg, target: deepPkg });
          
          // Internal Service Resolution (Layer 3)
          if (Math.random() > 0.5) {
            const serviceId = `internal-svc-${i}-${j}`;
            nodes.push({ id: serviceId, group: 4, val: 15, name: serviceId });
            links.push({ source: deepPkg, target: serviceId });
          }
        }
      });

      setData({ nodes, links });
    };

    generateGraph();
  }, [targetPackage]);

  if (!data) return null;

  return (
    <div ref={containerRef} className="w-full h-full absolute inset-0">
      <ForceGraph2D
        width={dimensions.width}
        height={dimensions.height}
        graphData={data}
        nodeColor={(node: any) => {
          if (node.group === 1) return '#ef4444'; // Target (Red)
          if (node.group === 4) return '#3b82f6'; // Internal service (Blue)
          return '#9ca3af'; // standard dep
        }}
        nodeLabel="name"
        nodeRelSize={6}
        linkColor={() => 'rgba(0,0,0,0.1)'}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        backgroundColor="#f9f9fb"
      />
    </div>
  );
}
