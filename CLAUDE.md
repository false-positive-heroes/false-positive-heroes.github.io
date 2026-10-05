# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, 8-language public record of antivirus false positives on one developer's software, observed through VirusTotal. Hosted on GitHub Pages at `false-positive-heroes.github.io` (org `false-positive-heroes`). No framework, no dependencies — plain Node 22 scripts and one HTML template.

## Commands

```sh
node --env-file=.env scripts/fetch.mjs   # needs FPH_EXPORT_URL and FPH_TOKEN in .env (gitignored)
node scripts/aggregate.mjs               # data/periods.json → data/*.json
node scripts/build.mjs                   # src/template.html + i18n/*.json → index.html, <lang>/index.html
```

There are no tests or linters. To preview, serve the repo root over HTTP (the page `fetch`es `data/*.json`, so `file://` does not work). To test aggregation scenarios (month freeze, late scans, retired files), copy `data/periods.json` into a scratch directory, edit `cutoff` / `scanned_through` / `retired`, and run `aggregate.mjs` from that directory — it uses cwd-relative `data/` paths.

`aggregate.mjs` skips daily/monthly files that already exist. To regenerate one after a rule change, delete it first — but only before it has been published. Once published, never delete or rewrite it; record the change in that month's `corrections`.

## Architecture

Data flows one way: **collector server → `fetch` → `aggregate` → `build` → Pages**.

- **Collector (not in this repo; server details are in the gitignored `CLAUDE.local.md`)**: a token-protected endpoint (URL and token are both secrets: `FPH_EXPORT_URL`, `FPH_TOKEN`) returns anonymized detection periods. `file_id` = `F-` + HMAC(secret salt, file name). File names, slugs, and hashes must never reach this repo, and server internals must not be written into any committed file — this repo is public.
  - The server scans clean files at 00·12 KST and detected files at 00·06·12·18 KST. This sets both the timestamp granularity and the workflow's run times.
  - A scan's time is VirusTotal's analysis date, but the row is inserted later, when the result is fetched. That is why freezing waits for `scanned_through`.
  - `data/periods.json` (the raw anonymized export) is committed and published on purpose, for verifiability and as a backup. Because of this, provisional figures are publicly readable as JSON even while the page shows COMING SOON.
- **Export fields that drive the rules**: `cutoff` (last scan), `scanned_through` (earliest last-scan among currently monitored files), `files`, and per period `detected`/`released`/`detected_total`/`released_total`/`retired`.
- **[scripts/aggregate.mjs](scripts/aggregate.mjs)** holds all scoring rules (see its header comment):
  - score = detection time inside the window ÷ 24h.
  - Clearance is "uncertain" if `released_total < detected_total` (fewer engines responded); it keeps accumulating.
  - `retired` (file left monitoring — new version or withdrawn) stops counting at the file's last scan; it is counted separately, never as "cleared".
  - `data/daily/*.json` and `data/monthly/*.json` are **written once and never rewritten**, and only after `scanned_through` passes the day/month end. Corrections go into a month's `corrections` array, not by editing figures. `data/current.json` (this month, provisional + `ongoing`, the false positives still active at the cutoff) and `data/index.json` are rewritten every run.
  - All day/month boundaries are KST.
- **[scripts/build.mjs](scripts/build.mjs)** renders the template once per language. `{{key}}` comes from `i18n/<lang>.json`; `{files}` is substituted from `data/current.json`. The whole language dict is also embedded as `T` for client-side JS. The build fails if any language file's key set differs from `en.json` — add every new string to all 8 files (en, ko, zh, es, ar, pt, id, fr). `ar` is RTL (`dir` key); English is the root page.
- **[src/template.html](src/template.html)** is the only page source. Never edit the generated `index.html` / `<lang>/index.html` directly. Client behaviour:
  - The ranking defaults to the latest final month; before the first final month exists, it shows "COMING SOON". This placeholder is temporary: after the first report (2026-11-01), delete the `.soon` markup/CSS, the `if(!index.months.length)` branch in `init()`, and the `comingSoon` i18n key.
  - The "daily false-positive status" section lists only `current.ongoing` (engine, file ID, detection name, and period = first-detected date + KST day count). `data/daily/*.json` is kept as an archive but not shown on the page.
  - `?m=` selects a month.
  - The contact address is assembled only on click, so it never appears in the source (anti-harvesting). Keep it that way.
- **[.github/workflows/update.yml](.github/workflows/update.yml)** runs 4× daily (02:17/08:17/14:17/20:17 KST, 2h17m after each server scan round): fetch → aggregate → build → commit → deploy via `actions/deploy-pages`. On push it only rebuilds and deploys. Needs the repo secrets `FPH_EXPORT_URL` and `FPH_TOKEN` and Pages source set to "GitHub Actions".

## Content constraints

The satirical copy (headline, "THE FALSE ALARM AWARDS") is deliberate and approved by the owner. It must stay aimed at the detection-count evaluation culture, never at a named vendor's intent. Keep the structural explanation in `awardText` and the `disclaimer` in every language when editing copy.