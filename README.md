# Krillion Fieldnotes

Independent Krillion answer and hints guide for getkrillion.xyz. It is not affiliated with krillion.io and does not host an independent guessing game. `/unlimited/` is intentionally not implemented.

## Build and preview

Node 20 or newer; the guide build has no third-party runtime dependencies.

```text
node tools/build-guide.mjs
node --test
node tools/dev.mjs
```

The npm `build` script and compatibility `tools/build.mjs` entry both build this guide. Open http://127.0.0.1:8788/ . `design/phase-one/` retains the original design preview with noindex. Its source templates generate the production pages; editing generated HTML directly will not survive a rebuild.

## Data and dates

`tools/record-reveal.mjs` reads the official date-matched reveal, validates exactly seven prompts and nonempty answer lists, and preserves answer spellings, aliases, rarity tiers and points. Quips and official artwork are omitted. Dated records are saved under `design/phase-one/records/`; `reveal-snapshot.json` points to the latest valid record. The old `data/prompts.json` and schedule are legacy material, not a source for official answer pages.

Dates follow America/New_York. Homepage and hints titles/headings derive from the saved record, not the computer's date alone. If a new reveal is unavailable, the previous record keeps its actual date and stops claiming to be today's answers. Historical page titles stay fixed. No future or unrecorded edition is generated.

## Production routes and SEO

- `/`: latest complete answers and progressive hints.
- `/answers/YYYY-MM-DD/`: a complete recorded seven-prompt edition.
- `/answers/YYYY-MM-DD/prompt-N/`: real prompt, hints, up to 200 initial answer rows, searchable full record and copy controls.
- `/hints/`, `/archive/`, `/how-to-play/`, `/scoring/`, `/score-calculator/`, `/why-answer-not-accepted/`, `/about/`.
- `/search/` works with date, prompt and rarity filters, but remains noindex, including query variants. `/privacy/` is also noindex.

Public pages have distinct Title, one H1, useful H2/H3, description, self canonical, Open Graph metadata and structured breadcrumbs. Only completed indexable routes enter the sitemap. Existing lastmod values are preserved when page content is unchanged. `/answers/` redirects to `/archive/`. Legacy independent-game date pages are removed rather than relabeled as official answers. Unavailable dates return 404.

Google Analytics uses measurement ID G-PJZ74G7C2B. Custom events exclude search terms and copied answer text; initial page_location excludes query parameters. Browser storage retains reviewed prompts and hint preferences. See `/privacy/`.

## Automated capture and publication

`.github/workflows/record-answers.yml` runs at 04:20 and 05:20 UTC (Beijing 12:20 and 13:20), on relevant source pushes, and on manual dispatch. It runs independently of this computer once committed to main.

1. Run tests. Capture the current Eastern date; a valid dated cache avoids a duplicate request. Source pushes perform one explicit API recheck.
2. Commit and push a valid snapshot before building pages. Invalid or unavailable data never replaces a valid record.
3. Build and commit production HTML/assets/sitemap. Cloudflare Pages deploys main through the existing Git integration.
4. Poll the public release identifier, then verify canonical/index settings, real date pages, sitemap count, future 404 and search noindex.
5. Report failed capture, validation, build, push or deployment to the configured WeCom robot. A failed capture still keeps the Actions run failed even if the previous edition can be published.

Set repository Actions Secret `WECHAT_WEBHOOK` to a WeCom group robot HTTPS webhook. It is never stored in source, HTML or logs. Manual dispatch with `notification_test=true` sends a test. `refresh_source=true` forces a single date-matched API recheck. The scheduler never loops against a rejected API.

The report at `design/phase-one/record-status.json` distinguishes capture, validation, build and deployment. Failure recovery artifacts last seven days; committed dated JSON is the durable archive. Actions may run late, and notification delivery is only confirmed when the robot API acknowledges it. Growing multi-MB daily records should eventually move from Git to object storage.
