# Blinds Company — Dashboard & Model Server

A React/Vite dashboard **layered on top of the vault**, plus a small Node/Express
server that makes it a **working model** — you can run the workflows from the UI
and watch them edit the vault. It reads the markdown notes in `../vault` and the
workflow specs in `../agents/workflows` directly; the vault stays the single
source of truth.

## Run the working model (recommended)

```bash
cd blinds-company/dashboard
npm install
npm run model      # builds the UI, then serves it + the API at http://localhost:8787
```

Open http://localhost:8787 → **System** tab. You'll see "model server connected"
and three buttons:

| Button | What it does |
|--------|--------------|
| **Run price watch** | Reads the Lutron price-increase email in the inbox, logs the +8% on the supplier note, bumps each affected product's cost, **flags the ones that drop below 50% margin**, lists the open quotes exposed, writes a briefing to `agents/logs/price-watch-log.md`, and moves the email to `10-raw/`. Deterministic — no AI needed. |
| **Run follow-ups** | Finds every `quoted` customer, picks the cadence stage by days since the quote, drafts a personalized message, and appends it to that customer's note as `DRAFT (not sent)`. Deterministic. |
| **Process inbox** | Shells out to the **Claude Code CLI** (`claude -p`) to file inbox items per `CLAUDE.md`. If the CLI isn't installed, it returns the exact command to run instead. |

After an action the dashboard reloads the live vault, so KPIs, the margin flag,
and timelines update immediately. Try **Run price watch**, then open the Catalog
tab — Blackout will be flagged ⚠️.

## Put the interactive model online (Render free tier)

GitHub Pages can only host the static view (buttons disabled). To get the
**buttons working from your phone**, deploy the server to a free host. A Render
Blueprint (`render.yaml`) is included at the repo root.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/UofMx2/Peptide-Dashboard-Mikev2)

1. Click the button (or Render dashboard → **New → Blueprint** → pick this repo).
2. Sign in with GitHub, authorize the repo, **Apply**. Render reads `render.yaml`,
   builds `blinds-company/dashboard`, and starts `server.mjs`.
3. You get a public URL like `https://blinds-company-model.onrender.com` — open it
   on your phone, go to **System**, and the action buttons work live.

Caveats on the free tier:
- The service **sleeps after ~15 min idle**; the first hit then takes ~50s to wake.
- The filesystem is **ephemeral** — actions edit the vault for real, but those
  edits reset on the next deploy/restart (great for a live demo, not permanent
  storage). For persistence, add a Render disk or have the server commit changes
  back to git.

## Run as a static dashboard (no server)

```bash
npm run dev        # http://localhost:5173  (live-reads ../vault at dev time)
npm run build      # outputs to dist/, then `npm run preview`
```

In static mode the action buttons are disabled ("static mode") because there's
no server to run them — the read-only views still work, falling back to the
markdown bundled at build time.

## How it reads the vault

- `src/lib/parse.js` is the isomorphic parser (frontmatter + body + timelines +
  cost/margin), shared by both the browser and the server so they produce an
  identical model.
- `src/lib/vault.js` (browser) calls `loadVault()`, which fetches `/api/vault`
  from the server when it's running, and otherwise falls back to the markdown
  bundled at build time via `import.meta.glob('../../../vault/**/*.md')`.
- `server.mjs` (Node) reads the same vault from disk with `fs`, serves
  `/api/vault`, runs the workflow actions, and serves the built `dist/`.
- `src/lib/workflows.js` reads the workflow specs in `../agents/workflows/*.md`.
- Edit any note, refresh, and the dashboard updates. Nothing is duplicated —
  change data by editing the markdown (or running an action), not the UI.

## Tabs

| Tab | Shows |
|-----|-------|
| **Overview** | KPIs (active customers, open-quote value, catalog, margin alerts), pipeline chart, recent activity, inbox alert |
| **Pipeline** | Customers as columns by status (lead → quoted → won → installed → warranty → lost) |
| **Customers** | Searchable/filterable table; click a row for a timeline drawer |
| **Catalog** | Products (with supplier + margin flags) and suppliers |
| **Operations** | SOP notes rendered from `vault/20-wiki/operations` |
| **System** | Unprocessed inbox items + the agent workflows + how the Trinity fits together |

## What it derives from the notes

- **Status** from each customer's `status:` frontmatter.
- **Quote value** parsed from the latest `quoted $X` line in the customer's `## Timeline`.
- **Open quote value** = sum of quote values for `status: quoted` customers.
- **Margin alerts** from any `> MARGIN ALERT` callout the price-watch workflow adds.
- **Inbox count** = files sitting in `vault/00-inbox` (unprocessed raw material).

So the dashboard's numbers move on their own as you capture into the inbox, run
the processor, and run the agent workflows. It visualizes the Trinity; it
doesn't replace it.
