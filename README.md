# SOABOS Dashboard

Public GitHub Pages dashboard for Bryon.

## Core workflow

### Normal publish

```bash
npm install
npm run build
```

That now does all of this automatically:
- rebuilds content JSON
- builds the Vite app
- refreshes root `index.html` and `404.html`
- refreshes root `assets/` for GitHub Pages

## Daily gratitude update

Use the sync script so the dashboard card stays current without hand-editing JSON:

```bash
npm run sync-gratitude -- --date=2026-03-31 --prompt="What is something in your life right now that would have felt impossible, out of reach, or unreal to an older version of you — and why does having it now matter more than you usually admit?"
npm run build
```

Optional flags:
- `--status=pending|completed`
- `--source="telegram + dashboard"`
- `--note="..."`
- `--window=morning-to-evening`
- `--completedLabel="..."`

## Survivor pool

The `#/pool` route runs a full NFL survivor (suicide) pool. Source data lives in
`content/pool.json`; `scripts/pool-engine.mjs` derives standings, strikes, eliminations,
and one-time-use team tracking at build time.

### Current format

- One pick per team per week, locking Sunday 1:00 PM ET
- Teams are one-time use — every pick burns that team for the season
- **Double elimination**: a loss is a strike, you are out on your second
- A tie counts as a survive (the team is still burned)
- A missed pick is a strike
- No BYE weeks, no buy-backs

### Running a week

Use the commissioner tool rather than hand-editing JSON:

```bash
npm run pool -- --add-entrant="Mike Ross,Sara P"
npm run pool -- --week=1 --pick="Bryon:DET,Mike Ross:KC"
npm run pool -- --week=1 --result="DET:win,KC:loss"
npm run pool -- --week=1 --status=final   # grades the week and opens week 2
npm run build
```

Results are recorded per team, so one `--result` list grades everyone who picked that
team. Run `npm run pool -- --help` for the full flag list.

### Changing the rules

Every variation is a setting, so the pool can be reconfigured without touching the engine:

```bash
npm run pool -- --set-strikesToEliminate=1              # single elimination
npm run pool -- --set-tieCountsAs=loss
npm run pool -- --set-byeWeeksPerPlayer=1
npm run pool -- --set-allowBuyBacks=true --set-buyBackFee=25 --set-buyBackDeadlineWeek=8
```

The rules panel on the pool page is generated from these settings, so the posted rules and
the scoring logic can never drift apart.

### Guardrails

The engine flags problems instead of silently mis-scoring them — a duplicate team pick, a
BYE with none left, a missed deadline, or a pick for an unknown entrant/team. Anything
flagged shows in a "Commissioner attention" panel on the pool page and prints after every
`npm run pool` command.

Run `npm run test-pool` to verify the scoring rules (strikes, eliminations, ties, team
burn, BYEs, missed picks, champion detection) after touching the engine.

## Why this matters

GitHub Pages serves the root `index.html` plus root `assets/` in this repo. If those do not get refreshed after a Vite build, the live site can point at stale hashed assets and show old behavior or break entirely.
