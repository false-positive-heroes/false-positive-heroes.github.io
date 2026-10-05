// Turns data/periods.json into the files the page reads:
//   data/current.json          this month (provisional) + false positives still ongoing at the cutoff
//   data/daily/YYYY-MM-DD.json  each finished KST day — written once, never rewritten
//   data/monthly/YYYY-MM.json   each finished month (final) — written once, never rewritten
//   data/index.json             list of the above for the page's selectors
//
// Scoring (methodVersion 1):
//   score = sum over periods of detection time inside the window ÷ 24h
//   A period is closed when the engine dropped the detection and the scan that showed it
//   had at least as many engines responding as the scan that first detected it.
//   Otherwise (released_total < detected_total) the clearance is "uncertain": it keeps
//   accumulating, because a missing response is not a clearance, until `confirmed` — the first
//   later scan with enough engines responding and no detection — closes it at that time.
//   A file removed from monitoring (new version or withdrawn) can no longer be cleared;
//   its open periods stop at the file's last scan and count as "retired", not as cleared.
//
// Days and months are frozen only once every monitored file has a scan after their end
// (scanned_through), so late-arriving results are not left out of a final record.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';

const METHOD_VERSION = 1;
const DAY = 864e5;
const KST = 9 * 36e5;

const raw = JSON.parse(readFileSync('data/periods.json', 'utf8'));
const since = Date.parse(raw.since);
const cutoff = Date.parse(raw.cutoff);
const freezable = raw.scanned_through === null ? cutoff : Math.min(cutoff, Date.parse(raw.scanned_through));
const periods = raw.periods.map(p => {
  const unconfirmed = p.released !== null && p.released_total < p.detected_total;
  const confirmed = p.confirmed ? Date.parse(p.confirmed) : null;
  return {
    ...p,
    from: Date.parse(p.detected),
    to: p.released === null ? null : unconfirmed && confirmed !== null ? confirmed : Date.parse(p.released),
    gone: p.retired === null ? null : Date.parse(p.retired),
    uncertain: unconfirmed && confirmed === null,
  };
});

const kstDate = t => new Date(t + KST).toISOString().slice(0, 10);
const kstStart = d => Date.parse(`${d}T00:00:00+09:00`);
const iso = t => new Date(t + KST).toISOString().slice(0, 19) + '+09:00';
const nextMonth = m => {
  const [y, mo] = m.split('-').map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
};
const write = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

// cleared (confirmed) by time t
const closedBy = (p, t) => p.to !== null && p.to <= t && !p.uncertain;
// file removed from monitoring by time t, while the period was still open
const retiredBy = (p, t) => p.gone !== null && p.gone <= t && !closedBy(p, p.gone);
// when the period stops counting, as seen at time t
const stopAt = (p, t) => (closedBy(p, t) ? p.to : retiredBy(p, t) ? p.gone : t);

function month(m, status) {
  const start = kstStart(`${m}-01`);
  const end = Math.min(kstStart(`${nextMonth(m)}-01`), cutoff);
  const engines = {};
  for (const p of periods) {
    const stop = stopAt(p, end);
    if (p.from >= end || stop <= start) continue;
    const e = engines[p.engine] ??= { name: p.engine, score: 0, count: 0, active: 0, closed: 0, uncertain: 0, retired: 0 };
    e.score += (stop - Math.max(p.from, start)) / DAY;
    e.count++;
    e[closedBy(p, end) ? 'closed' : retiredBy(p, end) ? 'retired' : p.to === null || p.to > end ? 'active' : 'uncertain']++;
  }
  const list = Object.values(engines)
    .map(e => ({ ...e, score: Math.round(e.score * 1e4) / 1e4 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return {
    month: m,
    status,
    since: iso(Math.max(start, since)),
    cutoff: iso(end),
    files: raw.files,
    methodVersion: METHOD_VERSION,
    engines: list,
    ...(status === 'final' && { corrections: [] }),
  };
}

function day(d) {
  const start = kstStart(d);
  const end = Math.min(start + DAY, cutoff);
  const pick = p => ({ file_id: p.file_id, engine: p.engine, result: p.result });
  const inDay = t => t >= start && t < start + DAY && t <= cutoff;
  const events = [];
  for (const p of periods) {
    if (inDay(p.from)) events.push({ time: iso(p.from), type: 'detected', ...pick(p) });
    if (p.to !== null && inDay(p.to) && !retiredBy(p, p.to)) events.push({ time: iso(p.to), type: p.uncertain ? 'uncertain' : 'released', ...pick(p) });
    if (retiredBy(p, end) && p.gone >= start) events.push({ time: iso(p.gone), type: 'retired', ...pick(p) });
  }
  events.sort((a, b) => a.time.localeCompare(b.time) || a.engine.localeCompare(b.engine));
  return {
    date: d,
    cutoff: iso(end),
    complete: end === start + DAY,
    events,
    ongoing: periods.filter(p => p.from < end && stopAt(p, end) === end).length,
  };
}

mkdirSync('data/daily', { recursive: true });
mkdirSync('data/monthly', { recursive: true });

for (let d = kstDate(since); kstStart(d) + DAY <= freezable; d = kstDate(kstStart(d) + DAY)) {
  const file = `data/daily/${d}.json`;
  if (!existsSync(file)) write(file, day(d));
}
for (let m = kstDate(since).slice(0, 7); kstStart(`${nextMonth(m)}-01`) <= freezable; m = nextMonth(m)) {
  const file = `data/monthly/${m}.json`;
  if (!existsSync(file)) write(file, month(m, 'final'));
}

const today = kstDate(cutoff);
const current = today.slice(0, 7);
// still detected at the last scan (an engine that dropped the detection is not listed, even if unconfirmed)
const ongoing = periods
  .filter(p => p.released === null && stopAt(p, cutoff) === cutoff)
  .sort((a, b) => a.from - b.from || a.engine.localeCompare(b.engine))
  .map(p => ({ file_id: p.file_id, engine: p.engine, result: p.result, since: iso(p.from), uncertain: p.uncertain }));
write('data/current.json', { ...month(current, 'provisional'), ongoing });

const list = dir => readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort().reverse();
write('data/index.json', { cutoff: iso(cutoff), current, today, months: list('data/monthly'), days: list('data/daily') });
console.log(`current: ${current}, today: ${today}, cutoff: ${iso(cutoff)}`);
