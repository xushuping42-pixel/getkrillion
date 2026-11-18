# Recording and publication

The active workflow definition is `.github/workflows/record-answers.yml`. It is effective once present on main. It replaces the legacy own-bank daily rebuild.

## Date-aware schedule

The cron `20 4,5 * * *` runs at Beijing 12:20 and 13:20. Each run computes its Eastern date. In winter the first window belongs to the previous game date; it must not suppress the second window's new-day capture. In summer both windows belong to the same date, and a complete cached record skips the second request. GitHub scheduling can be delayed and public-repository schedules can be disabled after 60 days without repository activity.

## Stages

1. `node tools/update-design.mjs --capture-only`: validate a seven-prompt reveal and save records atomically. The workflow commits and pushes the snapshot before page generation.
2. `node tools/update-design.mjs --build-only`: build only from stored data. With REVEAL_BUILD=production, generate the production guide; local runs default to the design preview.
3. Commit and push generated pages. Cloudflare's existing Git integration deploys main; no Deploy Hook is used.
4. `node tools/verify-deployment.mjs`: wait for the public release ID and verify indexable pages, canonical URLs, sitemap count, future 404 and search noindex. A local check is labeled local-check-passed, never a production verification.
5. `node tools/notify-failure.mjs`: on failure, send target date, stage, HTTP status when known and run URL to the WECHAT_WEBHOOK Secret. No webhook is written to Git or printed. Missing configuration or rejection by the robot is an error, not a claimed delivery.

Saved valid editions survive API, build and publishing failures. An old edition retains its real date. Homepage and hints titles use Latest Recorded instead of Today when the saved game date is older than the current Eastern date. Historical titles are fixed. Incomplete and future pages are never created.

The workflow serializes writers, rebases before pushing and keeps seven-day recovery artifacts after failures. Artifacts are not permanent storage; committed records are. Records grow by several MB per day, so object storage is the later scaling path.

## Validation

`node --test` covers date changes/DST, duplicate-request avoidance, corrupt caches, invalid and unavailable data, source rechecks, preservation of saved editions, independent capture/build stages, metadata, public links, crawlable prompt rows and notification failures. Network tests use mocked sources and robots. Actual GitHub/Cloudflare execution and a robot test message are separate operational checks.
