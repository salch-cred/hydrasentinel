# HydraSentinel

Supply-chain blast radius for the npm ecosystem — built on **HydraDB** and live npm registry data.

When a package gets compromised, the question is *"which of my services are exposed?"* HydraSentinel answers it: it resolves any npm package against the live registry, walks its dependency tree, measures real weekly downloads, flags shared maintainers — and persists every scan as a graph in **HydraDB**, where it runs the transitive **reverse dependency closure** to expose every known package that depends on the target.

```
[ Next.js app ] ──streaming NDJSON──▶ [ /api/traverse ] ──real traversal──▶ [ registry.npmjs.org ]
        │                                         │
        └──── OpenCypher (MERGE / MATCH) ─────────┴──▶ [ HydraDB graph node ]
```

## The HydraDB graph

HydraDB is the graph store: every completed scan is upserted as
`(:Package {name, version, downloads}) -[:DEPENDS_ON]-> (:Package)` nodes and edges via its
HTTPS query API (`POST /v1/graphs/{graph}/query`, OpenCypher). The headline query is the
transitive reverse closure — "which known packages depend on this one?":

```cypher
MATCH (p:Package)-[:DEPENDS_ON*1..3]->(c:Package)
WHERE c.name = $name
RETURN DISTINCT p.name AS name
```

The more you scan (or seed), the richer the answer — that is the "09:00 compromise →
09:06 exposure" story the explorer surfaces after every run.

### Run a HydraDB node

Pick one of the two supported ways from the [HydraDB repo](https://github.com/hydra-db/hydradb):

**Docker (fastest):**

```bash
mkdir -p hydradb-data/store hydradb-data/cache
printf '%s\n' 'local-development-token-32-bytes' > hydradb-data/auth-token
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -p 7687:7687 -p 8443:8443 -p 9090:9090 \
  -v "$PWD/hydradb-data:/data" \
  -e CLOUD_PROVIDER=local \
  -e LOCAL_PATH=/data/store \
  -e GRAPH_NAMESPACE=default \
  -e GRAPH_ID=default \
  -e GRAPH_CELL_ID=cell-0 \
  -e GRAPH_CELLS=cell-0 \
  -e GRAPH_NODE_ID=node-0 \
  -e GRAPH_BOLT_NODE_ADDRESSES=node-0=127.0.0.1:7687 \
  -e GRAPH_ADVERTISED_BOLT_ADDR=127.0.0.1:7687 \
  -e GRAPH_DATA_CACHE_DIR=/data/cache \
  -e GRAPH_AUTH_TOKEN_FILE=/data/auth-token \
  -e GRAPH_ALLOW_PLAINTEXT=true \
  -e RUST_MIN_STACK=33554432 \
  ghcr.io/hydra-db/hydradb:latest
```

**From source (Linux/macOS only):**

```bash
git clone https://github.com/hydra-db/hydradb.git
cd hydradb
# prerequisites: Rust 1.91+, libcypher-parser, SuiteSparse GraphBLAS
just native-check
just smoke
```

Then start the app and point it at the node:

```bash
cp .env.example .env.local   # defaults already match the dev node above
npm run dev
```

### No Docker on your machine?

Two options:

- **Local dev stand-in (any OS):** `node scripts/mock-hydradb.mjs` runs an in-memory
  server implementing the exact HydraDB HTTP query contract for the statements this
  app sends — including the transitive reverse closure — so you can develop and
  rehearse the demo with non-zero exposure results. It is **a development stand-in,
  not HydraDB**: point the app at it with `HYDRADB_URL=http://127.0.0.1:8444` (see
  `.env.local`), and swap in the real node for the actual demo.
- **Real node on any Docker-capable machine:** run `bash scripts/hydradb-node.sh`
  on a Linux box, WSL, or a free GitHub Codespace (Docker preinstalled), then point
  the app at it via `HYDRADB_URL`. The same code path runs against HydraDB itself.

### Configure

| Env var | Default | Purpose |
| --- | --- | --- |
| `HYDRADB_URL` | `http://127.0.0.1:8443` | Node query API |
| `HYDRADB_TOKEN` | `local-development-token-32-bytes` | Bearer token |
| `HYDRADB_GRAPH` | `default` | Graph id (also in URL path) |
| `HYDRADB_CELL` | `cell-0` | Cell id sent in the request body |
| `HYDRADB_NAMESPACE` | `default` | `X-Graph-Namespace` header |
| `HYDRADB_DISABLED` | unset | `1` forces offline mode |

Everything is best-effort: with no node reachable the explorer degrades gracefully
to live-registry-only scans and shows **HYDRADB OFFLINE**.

### Seed the graph

Load a real slice of the npm graph so reverse closures answer immediately:

```bash
curl "http://localhost:3000/api/hydradb/seed?packages=express,lodash,react-dom,commander,is-odd,chalk,axios,uuid,moment,debug,minimist,underscore"
```

Each package is traversed against the live registry and persisted into HydraDB.
You can also just run scans in the explorer — every one writes its subgraph too.

## Development

```bash
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

- `src/lib/registry.ts` — real npm traversal (resolve, bounded depth-2 expansion, downloads, shared maintainers)
- `src/lib/hydradb.ts` — HydraDB HTTP client (upsert, reverse closure, stats, config)
- `src/app/api/traverse/route.ts` — streaming NDJSON endpoint
- `src/app/api/hydradb/seed/route.ts` — graph seeding
- `src/app/page.tsx` — explorer UI (idle radar → live console → graph + report)
