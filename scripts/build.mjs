// Renders src/template.html once per language from i18n/*.json:
//   English → /index.html, others → /<lang>/index.html
// {{key}} is replaced from the language file (plus the values below); {files} comes from data/current.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const LANGS = ['en', 'ko', 'zh', 'es', 'ar', 'pt', 'id', 'fr'];
const SITE = 'https://false-positive-heroes.github.io/';
const ISSUE_URL = 'https://github.com/false-positive-heroes/false-positive-heroes.github.io/issues/new?template=correction.yml';

const files = JSON.parse(readFileSync('data/current.json', 'utf8')).files;
const template = readFileSync('src/template.html', 'utf8');
const dicts = Object.fromEntries(LANGS.map(l => [l, JSON.parse(readFileSync(`i18n/${l}.json`, 'utf8'))]));

const keys = Object.keys(dicts.en).sort().join();
for (const l of LANGS) if (Object.keys(dicts[l]).sort().join() !== keys) throw new Error(`i18n/${l}.json keys differ from en.json`);

const dir = l => (l === 'en' ? '' : `${l}/`);
const alternates = LANGS.map(l => `<link rel="alternate" hreflang="${dicts[l].langCode}" href="${SITE}${dir(l)}">`)
  .concat(`<link rel="alternate" hreflang="x-default" href="${SITE}">`).join('\n');
const langNames = JSON.stringify(Object.fromEntries(LANGS.map(l => [l, dicts[l].langName])));

for (const l of LANGS) {
  const t = Object.fromEntries(Object.entries(dicts[l]).map(([k, v]) => [k, v.replaceAll('{files}', files)]));
  const up = l === 'en' ? '' : '../';
  const vars = {
    ...t,
    base: up,
    canonical: SITE + dir(l),
    alternates,
    langNames,
    issueUrl: ISSUE_URL,
    i18n: JSON.stringify(t),
    langMenu: LANGS.map(o => `<option value="${up + dir(o) || './'}"${o === l ? ' selected' : ''}>${dicts[o].langName}</option>`).join(''),
  };
  const html = template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`${l}: missing {{${k}}}`);
    return vars[k];
  });
  if (dir(l)) mkdirSync(l, { recursive: true });
  writeFileSync(`${dir(l)}index.html`, html);
}
console.log(`built ${LANGS.length} pages (${files} files)`);
