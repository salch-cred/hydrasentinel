# Demo Video — 3 minutes (Hack Hydra submission)

Record this **with a HydraDB node running and the graph seeded** (see README →
"Seed the graph"). Unlisted YouTube link is fine. Nothing past 3:00 gets reviewed —
rehearse it.

**On-screen:** a phone or laptop recording the browser; narrate over a live screen
recording (OBS/QuickTime). The app at http://localhost:3000.

---

## 0:00–0:25 — The problem (fast, visceral)

> "In May, the TanStack CI breach published 84 malicious packages in six minutes.
> The worm hit Mistral, UiPath, and 160+ npm and PyPI packages. When a package is
> compromised at 09:00, which of your services are exposed by 09:06? That's a
> transitive reverse dependency closure — a graph problem, not a search problem."

**Screen:** brief text card or just the hero of the app.

## 0:25–1:05 — Real scan, live

> "HydraSentinel is a supply-chain blast-radius console. Everything you see is
> live — no mock data."

- Type `lodash` in the search (or tap the chip), hit Run analysis.
- Narrate the **streaming console**: "watch the real traversal — it resolves on
  the npm registry, walks the dependency tree, and pulls real weekly downloads."
- Show the report: **144M weekly downloads**, COMPROMISED badge, shared
  maintainers, traversal time.

**Key line:** "Every number here is fetched live from the registry."

## 1:05–1:45 — The HydraDB core (the money shot)

> "Every scan is persisted as a real graph in HydraDB — packages as nodes,
> `DEPENDS_ON` edges. That graph is what answers the blast-radius question."

- Scroll to **Your services** and click **Analyze my app** on the pre-filled
  package.json: "this is *my* app — 7 dependencies, resolved to real versions."
  Point at the **riskiest dependency** (debug@4.4.3, 468M downloads/wk) and the
  exposure path `billing-api → debug`. "That's the 09:00 → 09:06 answer for my
  own services."
- Scan `debug` in the explorer and point at the **"5 known dependents exposed"**
  chip — *billing-api is in the list.* "I pasted my app once, and now every scan
  tells me if I'm exposed." Then scan `expressjs` and show the **typosquat chip**:
  "edit-distance detection — two keystrokes from express. That's how typosquat
  attacks get in."
- Click **Simulate incident**: "here's the compromise window — the bad version
  was live from 5:46 PM. HydraDB runs the reverse closure: every known package
  that depended on it during that window. That is the 09:00 → 09:06 answer."

**Say the judges' own framing:** "This is graph traversal — a vector index
cannot answer this at all."

## 1:45–2:40 — Why HydraDB matters (what you lose without it)

> "Without HydraDB, we'd have a nice download-counting dashboard. The graph is
> what makes it a defense tool: nodes, edges, and the reverse closure that maps
> exposure. Seed more packages, and the answer gets richer."

- Click through a second scan to show the graph rendering with the **HYDRADB
  ONLINE** status and the "N known dependents exposed" chip.
- Optional 15s: show `curl localhost:3000/api/hydradb/seed` seeding real
  packages, then re-run the incident to show the exposed count jump.

## 2:40–3:00 — Close

> "HydraSentinel: a real, streaming blast-radius console on HydraDB. Repo is
> public, MIT-licensed, one command to run. Thanks for watching."

**Screen:** the repo (github.com/salch-cred/hydrasentinel) open.

---

## Before you record — checklist

- [ ] HydraDB node running, `curl localhost:3000/api/hydradb/seed` completed (the
      incident "exposed" count must be > 0 — that's the proof point)
- [ ] `HYDRADB` status shows **ONLINE** in the app
- [ ] Record in a quiet room, rehearse once, land **under 3:00**
- [ ] Video accessible without login (unlisted YouTube OK)
- [ ] Repo public, LICENSE present, README accurate — verify all links before submitting
