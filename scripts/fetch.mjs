// Downloads the anonymized false-positive periods from the collector into data/periods.json.
// Needs FPH_EXPORT_URL and FPH_TOKEN (GitHub secrets, or `node --env-file=.env scripts/fetch.mjs` locally).
// The URL is a secret too: it would reveal which apps are in the sample.
import { writeFileSync } from 'node:fs';

const url = process.env.FPH_EXPORT_URL;
const token = process.env.FPH_TOKEN;
if (!url || !token) throw new Error('FPH_EXPORT_URL and FPH_TOKEN must be set');

const res = await fetch(url, { headers: { 'X-FPH-Token': token } });
if (!res.ok) throw new Error(`export HTTP ${res.status}`);
const data = await res.json();
if (!Array.isArray(data.periods) || !data.since || !data.cutoff) throw new Error('unexpected export format');

writeFileSync('data/periods.json', JSON.stringify(data, null, 2) + '\n');
console.log(`periods: ${data.periods.length}, cutoff: ${data.cutoff}`);
