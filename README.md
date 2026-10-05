# False Positive Heroes

A public record of antivirus false positives on an independent developer's software, observed through VirusTotal.
Published at https://false-positive-heroes.github.io/ in 8 languages (English default).

## How it works

```
collector (private server)          this repository (public)
export endpoint ───────────────►  scripts/fetch.mjs      → data/periods.json   (anonymized periods)
                                   scripts/aggregate.mjs  → data/current.json   (this month, provisional + today)
                                                            data/daily/*.json    (one per finished KST day)
                                                            data/monthly/*.json  (one per finished month, final)
                                                            data/index.json
                                   scripts/build.mjs      → index.html, <lang>/index.html
```

- File names and hashes never leave the collector. Files appear as `F-xxxxxxxx` IDs (HMAC of the file name).
- Daily and monthly files are written once and never rewritten. Corrections go into a month's `corrections` list.
- Scoring rules are in [scripts/aggregate.mjs](scripts/aggregate.mjs) (`methodVersion` in each file).

## Schedule

GitHub Actions ([.github/workflows/update.yml](.github/workflows/update.yml)) runs 4× daily at 02:17, 08:17, 14:17 and 20:17 KST (2h17m after each scan round).
Each run refreshes this month and today; finished days and months are written once.
A day (or, on the 1st, the previous month) is frozen only after every monitored file has been scanned past its end.

## Setup

1. Repository secrets `FPH_EXPORT_URL` (the collector's export endpoint) and `FPH_TOKEN` (its access token). The URL is kept secret because it would reveal which apps are in the sample.
2. Settings → Pages → Source: **GitHub Actions**.

## Local run

```sh
node --env-file=.env scripts/fetch.mjs   # .env: FPH_EXPORT_URL=..., FPH_TOKEN=...
node scripts/aggregate.mjs
node scripts/build.mjs
```

Text lives in `i18n/<lang>.json` (all files must have the same keys); layout in `src/template.html`.

## License

Code: [MIT](LICENSE). Data in `data/`: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — credit "False Positive Heroes" and link to https://false-positive-heroes.github.io/.
