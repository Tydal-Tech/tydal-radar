# Automated market refresh (local scheduled — "option B")

Keeps the prospect data fresh and reports how the market changed, on a monthly
cadence, from your Mac. No cloud infra, no recurring hosting cost — it reuses
the existing scraper and snapshot-diff, so there's nothing running blind in
production.

## What it does

Once a month `scripts/refresh-and-report.sh`:

1. Runs a full-city re-scrape (`radar-grid-scrape.js --update`) — overwrites
   stale fields (name/phone/address/rating/website/business-status) and, on
   every run, writes the found set to `market-snapshots/market-<ISO>.json`.
2. Diffs the **two newest** market snapshots (`scripts/diff-snapshots.mjs`) into
   `reports/market-change-<date>.txt`.
3. Pops a Notification Center banner with the headline (`+N new · -N gone`).

Why a found-set snapshot instead of the DB? The DB never deletes rows (a closed
business just goes stale), so DB backups only ever show growth. The scraper's
per-run found set is the true market state, so diffing two of them reveals both
**new openings** and **closures**.

## Cost & cadence

- ~1,872 Places calls per run (a full city sweep). Monthly is plenty — Montreal
  SMBs turn over on a monthly-to-quarterly timescale, not weekly.
- To change cadence, edit `StartCalendarInterval` in the plist (e.g. add a
  second `<dict>` for mid-month, or change `Day`).

## Install

```sh
cp scripts/com.tydal.radar.refresh.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.tydal.radar.refresh.plist
```

Test it immediately (this does a real scrape / spends quota):

```sh
launchctl start com.tydal.radar.refresh   # or just: ./scripts/refresh-and-report.sh
```

The **first** run only seeds a snapshot (a diff needs two dates); every run
after that produces a real change report.

## Uninstall

```sh
launchctl unload ~/Library/LaunchAgents/com.tydal.radar.refresh.plist
rm ~/Library/LaunchAgents/com.tydal.radar.refresh.plist
```

## Notes

- If the Mac is asleep at 09:00 on the 1st, launchd runs the job at the next
  wake. It won't run if the machine is off all day — that's the one tradeoff vs
  a cloud cron (revisit the bounded-watchlist cloud cron if you outgrow this).
- `market-snapshots/` and `reports/` are git-ignored (local data).
- Run a report any time by hand: `node scripts/diff-snapshots.mjs`.
