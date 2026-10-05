// Renders src/template.html once per language from i18n/*.json:
//   English → /index.html, others → /<lang>/index.html, plus sitemap.xml and robots.txt.
// {{key}} is replaced from the language file (plus the values below); {files} comes from data/current.json.
// {{r_*}} is the static first render of the data sections (src/render.mjs), so crawlers see the content
// without running JavaScript; the page script uses the same functions for month switching, search and sort.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { noticeHtml, monthOptions, rankRows, nowParts, fmt, nextFirst } from '../src/render.mjs';

const LANGS = ['en', 'ko', 'zh', 'es', 'ar', 'pt', 'id', 'fr'];
const SITE = 'https://false-positive-heroes.github.io/';
const ISSUE_URL = 'https://github.com/false-positive-heroes/false-positive-heroes.github.io/issues/new?template=correction.yml';

const readJson = f => JSON.parse(readFileSync(f, 'utf8'));
const current = readJson('data/current.json');
const index = readJson('data/index.json');
const latestFinal = index.months[0] ? readJson(`data/monthly/${index.months[0]}.json`) : null;
const files = current.files;
const template = readFileSync('src/template.html', 'utf8');
const renderJs = readFileSync('src/render.mjs', 'utf8').replace(/^export /gm, '');
const dicts = Object.fromEntries(LANGS.map(l => [l, readJson(`i18n/${l}.json`)]));

const keys = Object.keys(dicts.en).sort().join();
for (const l of LANGS) if (Object.keys(dicts[l]).sort().join() !== keys) throw new Error(`i18n/${l}.json keys differ from en.json`);

const dir = l => (l === 'en' ? '' : `${l}/`);
const alternates = LANGS.map(l => `<link rel="alternate" hreflang="${dicts[l].langCode}" href="${SITE}${dir(l)}">`)
  .concat(`<link rel="alternate" hreflang="x-default" href="${SITE}">`).join('\n');
const langNames = JSON.stringify(Object.fromEntries(LANGS.map(l => [l, dicts[l].langName])));
const months = [current.month, ...index.months];
const shown = latestFinal;   // the ranking shows the latest final report; none yet → "coming soon"

const OG_LOCALE = { en: 'en_US', ko: 'ko_KR', zh: 'zh_CN', es: 'es_ES', ar: 'ar_AR', pt: 'pt_BR', id: 'id_ID', fr: 'fr_FR' };
const FAVICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%2319241d'/><text x='16' y='24' font-size='22' font-weight='900' text-anchor='middle' fill='%23d8ef72' font-family='sans-serif'>!</text></svg>";
const REPO = 'https://github.com/false-positive-heroes/false-positive-heroes.github.io';

// JSON-LD: one Organization/WebSite/Dataset entity (same @id on every page) + this page.
// Text comes from the visible page (title, description, methodology card 01) — never anything not shown.
function jsonLd(t, url) {
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': SITE + '#org', name: 'False Positive Heroes', url: SITE, sameAs: [REPO] },
      { '@type': 'WebSite', '@id': SITE + '#website', url: SITE, name: 'False Positive Heroes', publisher: { '@id': SITE + '#org' }, inLanguage: LANGS.map(l => dicts[l].langCode) },
      { '@type': 'WebPage', '@id': url + '#webpage', url, name: t.title, description: t.description, inLanguage: t.langCode,
        isPartOf: { '@id': SITE + '#website' }, about: { '@id': SITE + '#dataset' }, dateModified: current.cutoff },
      { '@type': 'Dataset', '@id': SITE + '#dataset', name: 'False Positive Heroes: antivirus false-positive periods', description: t.m1,
        url: SITE, creator: { '@id': SITE + '#org' }, license: 'https://creativecommons.org/licenses/by/4.0/', isAccessibleForFree: true,
        temporalCoverage: `${current.since.slice(0, 10)}/..`, dateModified: current.cutoff,
        distribution: ['current.json', 'periods.json', 'index.json'].map(f => ({ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE}data/${f}` })) },
    ],
  };
  const json = JSON.stringify(ld);
  if (json.includes('<')) throw new Error('JSON-LD must not contain "<"');   // would break out of the <script>
  return json;
}

for (const l of LANGS) {
  const t = Object.fromEntries(Object.entries(dicts[l]).map(([k, v]) => [k, v.replaceAll('{files}', files)]));
  const lang = t.langCode;
  const up = l === 'en' ? '' : '../';
  const now = nowParts(t, current);
  const vars = {
    ...t,
    base: up,
    canonical: SITE + dir(l),
    alternates,
    langNames,
    issueUrl: ISSUE_URL,
    i18n: JSON.stringify(t),
    renderJs,
    ogLocale: OG_LOCALE[l],
    ogImage: SITE + 'og.png',
    favicon: FAVICON,
    jsonLd: jsonLd(t, SITE + dir(l)),
    langMenu: LANGS.map(o => `<option value="${up + dir(o) || './'}"${o === l ? ' selected' : ''}>${dicts[o].langName}</option>`).join(''),
    r_notice: noticeHtml(t, lang, shown, current),
    r_months: monthOptions(t, lang, months, shown ? shown.month : current.month),
    r_rows: shown ? rankRows(t, shown.engines) : '',
    r_rankHide: shown ? '' : ' hidden',
    r_soonHide: shown ? ' hidden' : '',
    r_soon: fmt(t.comingSoon, { date: nextFirst(lang, current.month) }),
    r_nowDesc: now.desc,
    r_nowSummary: now.summary,
    r_nowRows: now.rows,
  };
  const html = template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`${l}: missing {{${k}}}`);
    return vars[k];
  });
  if (dir(l)) mkdirSync(l, { recursive: true });
  writeFileSync(`${dir(l)}index.html`, html);
}

const lastmod = current.cutoff.slice(0, 10);
const links = LANGS.map(o => `<xhtml:link rel="alternate" hreflang="${dicts[o].langCode}" href="${SITE}${dir(o)}"/>`)
  .concat(`<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}"/>`).join('');
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${LANGS.map(l => `<url><loc>${SITE}${dir(l)}</loc><lastmod>${lastmod}</lastmod>${links}</url>`).join('\n')}
</urlset>
`);
writeFileSync('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);

// llms.txt: guide for AI crawlers (what this site is the primary source of, where the data is, how to cite)
const en = dicts.en;
const ongoing = current.ongoing.length;
writeFileSync('llms.txt', `# False Positive Heroes

> Public record of antivirus false positives on one independent developer's software, observed through VirusTotal. It is the primary source for detection-days per antivirus engine on this sample of ${files} files. Updated four times a day; data as of ${current.cutoff.slice(0, 10)} (KST). ${ongoing} false positives are ongoing.

## Pages
${LANGS.map(l => `- [${dicts[l].langName}](${SITE}${dir(l)}): ranking by detection-days and current false positives`).join('\n')}

## Data (JSON, CC BY 4.0)
- [Current month and ongoing false positives](${SITE}data/current.json): provisional figures, rewritten every update
- [Index of reports](${SITE}data/index.json): final monthly reports are data/monthly/YYYY-MM.json, published on the 1st of each month and never revised
- [Raw anonymized detection periods](${SITE}data/periods.json)

## Method
- ${en.m2}
- ${en.m3}
- ${en.m1}
- Files appear only as anonymous IDs; app and file names are withheld.

## Citation
- Cite as "False Positive Heroes (${SITE})" with the data date. License: CC BY 4.0.
- Corrections: ${ISSUE_URL}
`);

// 404 page (GitHub Pages serves it with a 404 status)
writeFileSync('404.html', `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Page not found – False Positive Heroes</title><meta name="robots" content="noindex"><link rel="icon" href="${FAVICON}">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f2eb;color:#19241d;font-family:Inter,Pretendard,'Noto Sans KR',system-ui,sans-serif;text-align:center;padding:0 16px}h1{font-size:40px;letter-spacing:-1px;margin:0 0 12px}a{color:inherit}</style>
</head><body><main><h1>There was no page.</h1><p>404 · <a href="/">False Positive Heroes</a></p></main></body></html>
`);
console.log(`built ${LANGS.length} pages + sitemap.xml + robots.txt + llms.txt + 404.html (${files} files)`);
