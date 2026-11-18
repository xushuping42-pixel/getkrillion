# Design source and local preview

The forest-green layout, progressive hints, answer cards, search and archive are the design source for the production guide. The independent practice game has been removed from navigation and page generation. `/unlimited/` remains deferred.

```text
node tools/build-design.mjs
node tools/preview-design.mjs
```

The design preview remains noindex, without analytics. Production is built separately by `node tools/build-guide.mjs`; that command converts links to clean routes, adds SEO metadata and analytics, and publishes only complete saved editions.

The current verified data covers November 18, 2026: seven prompts and 69,625 answer records. Missing historical dates are not reconstructed from the old independent bank. Each new successful capture extends the archive and generates one dated page and seven complete prompt pages.

See the repository README and RECORDING.md for automatic recording and publication.
