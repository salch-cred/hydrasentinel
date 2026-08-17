"use client";

import { useState } from "react";
import { 
  Search01Icon, 
  Alert01Icon, 
  Shield02Icon, 
  NodeNetworkIcon,
  ServerIcon,
  Layers01Icon
} from "hugeicons-react";
import DependencyGraph from "@/components/DependencyGraph";

export default function Home() {
  const [packageName, setPackageName] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [results, setResults] = useState<null | any>(null);

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageName) return;
    
    setIsSimulating(true);
    // Simulate real data fetching delay
    setTimeout(() => {
      setResults({
        target: packageName,
        affectedServices: 14,
        criticalPaths: 3,
        maintainersShared: 2,
        timeToCompromise: "12ms"
      });
      setIsSimulating(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen p-8 md:p-12 lg:p-24 max-w-7xl mx-auto">
      <header className="mb-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-clay-accent/10 flex items-center justify-center text-clay-accent">
            <Shield02Icon size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">HydraSentinel</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-clay-text-muted">Powered by HydraDB</span>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input and Stats */}
        <div className="lg:col-span-4 space-y-6">
          <div className="clay-card p-6">
            <h2 className="text-lg font-semibold mb-2">Simulate Compromise</h2>
            <p className="text-sm text-clay-text-muted mb-6">
              Enter an npm or PyPI package to trace its transitive blast radius across the internal ecosystem.
            </p>
            
            <form onSubmit={handleSimulate} className="space-y-4">
              <div className="relative">
                <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-clay-text-muted" size={18} />
                <input
                  type="text"
                  placeholder="e.g. react-dom, left-pad..."
                  className="clay-input w-full pl-10 pr-4 py-2.5 text-sm"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                />
              </div>
              <button 
                type="submit"
                disabled={isSimulating}
                className="clay-button w-full py-2.5 flex justify-center items-center gap-2"
              >
                {isSimulating ? (
                  <span className="animate-pulse">Traversing Graph...</span>
                ) : (
                  <>
                    <NodeNetworkIcon size={18} />
                    <span>Run Analysis</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {results && (
            <div className="clay-card p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-2 text-red-500 mb-4">
                <Alert01Icon size={20} />
                <h3 className="font-semibold">Compromise Detected</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                  <div className="text-2xl font-bold text-red-600">{results.affectedServices}</div>
                  <div className="text-xs text-red-500 font-medium">Affected Services</div>
                </div>
                <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                  <div className="text-2xl font-bold text-orange-600">{results.criticalPaths}</div>
                  <div className="text-xs text-orange-500 font-medium">Critical Paths</div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-clay-border">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-clay-text-muted">Graph Traversal Time</span>
                  <span className="font-mono font-medium">{results.timeToCompromise}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Visualization */}
        <div className="lg:col-span-8">
          <div className="clay-card h-full min-h-[500px] flex flex-col overflow-hidden relative">
            <div className="p-4 border-b border-clay-border flex justify-between items-center bg-white z-10">
              <h2 className="font-medium text-sm">Transitive Dependency Map</h2>
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  <Layers01Icon size={14} /> Packages
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
                  <ServerIcon size={14} /> Internal Services
                </span>
              </div>
            </div>
            
            <div className="flex-1 bg-clay-bg flex items-center justify-center relative">
              {/* This is a placeholder for the actual force graph. We will integrate react-force-graph-2d next */}
              {isSimulating ? (
                <div className="text-clay-accent flex flex-col items-center gap-4 animate-pulse">
                  <NodeNetworkIcon size={48} />
                  <p className="text-sm font-medium">Querying HydraDB Core...</p>
                </div>
              ) : results ? (
                <DependencyGraph targetPackage={results.target} />
              ) : (
                <div className="text-center max-w-sm text-clay-text-muted">
                  <NodeNetworkIcon size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-sm">Awaiting target package to generate dependency blast radius map.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
