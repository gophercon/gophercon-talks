# GopherCon Talk Archive prototype

Static prototype for a sibling site to `gophercon.com`. It uses 2026 conference content and an Emerald City / Wizard of Oz visual theme.

## Run locally

```sh
python3 -m http.server 4173
```

Open <http://localhost:4173>.

The preview polls `data/content.json` every two seconds with browser caching disabled. Open pages rerender when content changes.

## Update content

Edit `data/content.json`. Speaker and talk pages are generated from that file; no HTML changes are needed.

Refresh all 2026 agenda and speaker content from GopherCon's public pages:

```sh
node scripts/import-2026.mjs
```

Refresh minimal 2025 content from two Gopher Academy YouTube playlists:

```sh
node scripts/import-2025.mjs
```

The importer keeps talks, panels, lightning-talk blocks, and named workshops. It excludes registration, meals, breaks, exhibitions, community logistics, and meetups. Speaker records are retained only when referenced by included content.

Lightning-talk sessions remain as session pages. Each embedded presentation is also parsed into a standalone talk page linked to its parent session.

`content.json` stores a year-indexed catalog. Importers update their own year and preserve other years.

Year-specific themes are selected with `body[data-year]`. The 2025 theme uses New York skyline, subway, and taxi motifs; 2026 uses Emerald City and yellow-brick-road motifs.

- `speakers[].id` must be unique.
- `talks[].speakerIds` reference speaker IDs.
- `speakers[].listed` controls inclusion in the 47-person public speaker directory. Unlisted participant records remain available to agenda sessions.
- Empty `youtube` values render “Video coming soon.” Add the `@GopherAcademy` video URL when published.
- `slides` and `materials` are optional.
- Keep `sourceUrl` for import provenance only. Do not expose year-specific `gophercon.com` agenda links; that site is replaced annually.
- Add years to `availableYears` after importing their content. This prototype currently includes 2026 only.

All remote headshots and factual conference copy are attributed to their source pages through `sourceUrl` fields.
