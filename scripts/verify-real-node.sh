#!/usr/bin/env bash
# verify-real-node.sh — prove the full loop against a REAL HydraDB node.
#
# Run this inside a GitHub Codespace for this repo (Docker + Node preinstalled,
# no local setup needed). It starts the real HydraDB node, boots the app against
# it, seeds a real npm slice, ingests a sample app ("billing-api"), scans debug,
# and checks that billing-api appears in the exposed dependents — the answer the
# brief's "which services are exposed" question is about.
#
#   Open:  https://github.com/codespaces/new?repo=salch-cred/hydrasentinel
#   Then:  bash scripts/verify-real-node.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 1/5  start the real HydraDB node (Docker) =="
if ! curl -sf http://127.0.0.1:9090/readyz >/dev/null 2>&1; then
  bash scripts/hydradb-node.sh > /tmp/hydradb-node.log 2>&1 &
  NODE_PID=$!
fi
NODE_OK=0
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:9090/readyz >/dev/null 2>&1; then NODE_OK=1; break; fi
  sleep 2
done
if [ "$NODE_OK" != "1" ]; then echo "FAIL: HydraDB node did not become ready"; tail -20 /tmp/hydradb-node.log 2>/dev/null; exit 1; fi
echo "   node ready"

echo "== 2/5  install app deps =="
[ -d node_modules ] || npm install --no-audit --no-fund > /tmp/npm-install.log 2>&1

echo "== 3/5  start the app against the real node =="
if ! curl -sf http://localhost:3000/ >/dev/null 2>&1; then
  HYDRADB_URL=http://127.0.0.1:8443 npm run dev > /tmp/app.log 2>&1 &
  APP_PID=$!
fi
APP_OK=0
for i in $(seq 1 90); do
  if curl -sf http://localhost:3000/ >/dev/null 2>&1; then APP_OK=1; break; fi
  sleep 2
done
if [ "$APP_OK" != "1" ]; then echo "FAIL: app did not start"; tail -20 /tmp/app.log 2>/dev/null; exit 1; fi
echo "   app up"

echo "== 4/5  seed a real npm slice, ingest billing-api, scan debug =="
curl -sf "http://localhost:3000/api/hydradb/seed" | tee /tmp/seed.json | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('   seeded', j.seeded.length, 'packages | graph:', j.packages, 'pkgs,', j.edges, 'edges');
"
curl -sf -X POST http://localhost:3000/api/yourservices \
  -H "Content-Type: application/json" \
  --data '{"manifest":"{\"name\":\"billing-api\",\"dependencies\":{\"express\":\"^4.19.2\",\"axios\":\"^1.6.8\",\"lodash\":\"^4.17.21\",\"debug\":\"^4.3.4\",\"moment\":\"^2.29.4\",\"uuid\":\"^9.0.1\",\"chalk\":\"^4.1.2\"}}"}' \
  > /tmp/ys.json
curl -sf "http://localhost:3000/api/traverse?package=debug" > /tmp/scan.ndjson

echo "== 5/5  result =="
node -e "
const fs=require('fs');
const ys=JSON.parse(fs.readFileSync('/tmp/ys.json','utf8'));
const scan=fs.readFileSync('/tmp/scan.ndjson','utf8').trim().split('\n').map(JSON.parse);
const h=scan.find((l)=>l.type==='hydradb');
const exposed=(h && h.reverse) || [];
console.log('registered in HydraDB :', ys.registeredInHydradb);
console.log('riskiest dependency   :', ys.riskiest ? ys.riskiest.name+'@'+ys.riskiest.version : '(none)');
console.log('exposure paths        :', JSON.stringify(ys.exposedPaths));
console.log('reverse closure (debug):', exposed.join(', '));
if (exposed.includes('billing-api') && ys.registeredInHydradb && ys.riskiest) {
  console.log('PASS — billing-api is exposed against the real HydraDB node.');
} else {
  console.log('FAIL — expected billing-api in the closure.');
  process.exitCode = 1;
}
"
