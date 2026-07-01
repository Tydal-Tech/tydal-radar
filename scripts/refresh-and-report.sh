#!/usr/bin/env bash
#
# Option B — local scheduled market refresh + change report.
#
# Re-scrapes the full city (overwrites enrichment + writes a market-snapshots/
# found-set), then diffs the two newest snapshots into a report and pings
# Notification Center with the headline. Run it monthly via the launchd job in
# scripts/com.tydal.radar.refresh.plist, or by hand:
#
#   ./scripts/refresh-and-report.sh
#
# The first run only seeds a snapshot (a diff needs two dates); every run after
# that produces a real "+N new · -N gone" report.
set -uo pipefail

# launchd runs with a minimal PATH — make sure node (and the repo) resolve.
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1

mkdir -p reports
STAMP="$(date +%Y-%m-%d)"
REPORT="reports/market-change-${STAMP}.txt"

echo "== Tydal Radar refresh — $(date) ==" | tee "$REPORT"

# Full-city re-scrape (overwrites stale fields, captures a market snapshot).
if ! node --env-file=.env.local radar-grid-scrape.js --update 2>&1 | tee -a "$REPORT"; then
  echo "Scrape failed — see $REPORT" | tee -a "$REPORT"
  osascript -e 'display notification "Scrape failed — check the report" with title "Tydal Radar"' 2>/dev/null || true
  exit 1
fi

# Diff the two newest market snapshots into the report (first run has only one).
echo "" | tee -a "$REPORT"
if node scripts/diff-snapshots.mjs 2>&1 | tee -a "$REPORT"; then
  HEADLINE="$(grep -m1 'new  ·' "$REPORT" || echo 'Refresh complete')"
else
  HEADLINE="Snapshot seeded — change report starts next run"
fi

osascript -e "display notification \"${HEADLINE}\" with title \"Tydal Radar · market refresh\"" 2>/dev/null || true
echo "Report: $REPORT"
