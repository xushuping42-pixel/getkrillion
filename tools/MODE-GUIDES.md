# Evergreen Krillion guides

Content: `tools/mode-guides.mjs`. Publication: `node tools/build-guide.mjs`.
The source review date is editorial; hourly answer builds must not advance it.

Routes:
- /krillion-unlimited/
- /krillion-multiplayer/
- /krillion-minecraft/
- /krillion-roblox/

All four have undated titles, one H1, self canonicals, index/follow robots,
BreadcrumbList and sitemap entries. Home adds one link to Unlimited; every
new guide links to its three siblings. Tests enforce the two-click path.
The deployment verifier checks all four routes. `indexable` in build output
means technically eligible, not that Google has actually indexed a page.

After deployment:
1. Confirm the production release and HTTP 200 responses on all four routes.
2. In the verified Search Console property, inspect each exact canonical URL.
   Run a live test and request indexing where available; record the actual
   indexed status separately. Sitemap inclusion does not prove indexing.
3. In Performance > Search results, filter Page to the exact Unlimited URL
   and Query to exactly `krillion unlimited`. Record the first impression
   date, impressions and clicks. Do not treat a related query as the exact
   head term. Data can be delayed.
4. If pages remain excluded, use the stated URL Inspection reason to decide
   what to fix. Do not mass-resubmit unchanged pages or claim completion.

No Search Console access or indexing result is assumed by the build.
The local preview is `node tools/dev.mjs --port 8789`.