// HTML rendering shared by scripts/build.mjs (static first render, for SEO) and the page script
// (month switching, search, sort). Pure functions, no DOM. build.mjs inlines this file into the page
// with the `export` keywords stripped, so keep it plain browser-compatible JavaScript.

export const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export const kst = s => s.slice(0, 16).replace('T', ' ');   // ISO (+09:00) → 'YYYY-MM-DD HH:MM'
const sep = lang => (lang.startsWith('zh') ? '' : ' ');      // Chinese joins sentences without a space
const date = (lang, y, m, o) => new Intl.DateTimeFormat(lang, { ...o, timeZone: 'UTC' }).format(Date.UTC(y, m - 1, 1));
export const monthName = (lang, m) => { const [y, mo] = m.split('-').map(Number); return date(lang, y, mo, { year: 'numeric', month: 'long' }); };
export const nextFirst = (lang, m) => {
  const [y, mo] = m.split('-').map(Number);
  const s = date(lang, y, mo + 1, { year: 'numeric', month: 'long', day: 'numeric' });
  return lang === 'fr' ? s.replace(/^1 /, '1er ') : s;
};

// notice above the ranking; d = the month shown, or null before the first final report (coming soon)
export function noticeHtml(T, lang, d, current) {
  const m = d ?? current;
  const since = kst(m.since) > m.month + '-01 00:00' ? fmt(T.noticeSince, { since: kst(m.since) }) : '';
  const head = !d ? ''
    : d.status === 'final' ? fmt(T.noticeFinal, { month: monthName(lang, d.month), end: kst(d.cutoff) })
    : fmt(T.noticeProvisional, { month: monthName(lang, d.month), cutoff: kst(d.cutoff), next: nextFirst(lang, d.month) });
  return [head, since, T.noticeAnon].filter(Boolean).join(sep(lang));
}

export function monthOptions(T, lang, months, selected) {
  return months.map((m, i) => `<option value="${m}"${m === selected ? ' selected' : ''}>${cap(fmt(i ? T.monthFinal : T.monthProvisional, { month: monthName(lang, m) }))}</option>`).join('');
}

export function rankRows(T, engines, q = '', key = 'score') {
  const ordered = [...engines].sort((a, b) => b[key] - a[key] || b.score - a.score || a.name.localeCompare(b.name));
  return ordered.filter(e => e.name.toLowerCase().includes(q)).map(e => `<tr><td class="rank">${String(ordered.indexOf(e) + 1).padStart(2, '0')}</td><td class="engine">${esc(e.name)}<small>VirusTotal</small></td><td><div class="score">${e.score.toFixed(4)}</div></td><td>${e.count}</td><td>${e.active} / ${e.closed} / ${e.retired}</td><td><span class="badge">${fmt(T.cases, { n: e.uncertain })}</span></td></tr>`).join('')
    || `<tr><td colspan="6" class="empty">${T.noResults}</td></tr>`;
}

// "current false-positive status": still detected at the last scan, longest first
export function nowParts(T, current) {
  const o = current.ongoing, today = current.cutoff.slice(0, 10);
  const dayN = s => (Date.parse(today) - Date.parse(s.slice(0, 10))) / 864e5 + 1;   // KST calendar days, first-detected day = 1
  return {
    desc: esc(fmt(T.nowDesc, { date: today })),
    summary: esc(fmt(T.nowSummary, { n: o.length, engines: new Set(o.map(p => p.engine)).size })),
    rows: o.map(p => `<tr><td class="engine">${esc(p.engine)}</td><td class="mono">${esc(p.file_id)}</td><td class="mono">${esc(p.result)}</td><td class="center">${fmt(T.period, { date: p.since.slice(0, 10), n: dayN(p.since) })}</td></tr>`).join('')
      || `<tr><td colspan="4" class="empty">${T.nowEmpty}</td></tr>`,
  };
}
