/**
 * parse.js — Build-time script for The Wisdom Vault
 * Reads every .txt file in /summaries, parses it into structured JSON,
 * auto-assigns tags from 10 curated categories, and writes public/data.json.
 *
 * Run:  node scripts/parse.js
 * Vercel build command:  node scripts/parse.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const SUMMARIES_DIR = path.join(__dirname, '..', 'summaries');
const PUBLIC_DIR    = path.join(__dirname, '..', 'public');
const OUTPUT_FILE   = path.join(PUBLIC_DIR, 'data.json');

// ── 10 curated tags ────────────────────────────────────────────────────────
const TAG_RULES = [
  {
    tag: 'Technology',
    kws: [
      'artificial intelligence',' ai ','machine learning','deep learning',
      'software','hardware','digital','algorithm','chip','semiconductor',
      'computer','internet','robot','automat','gpt','llm','openai',
      'quantum','cyber','5g','huawei','data center','cloud computing',
      'app ','coding','programming','neural network','tech company',
      'smartphone','processor','gpu','nvidia'
    ]
  },
  {
    tag: 'Finance',
    kws: [
      'financ','banking','invest','capital','fund','stock market','gold',
      'econom','revenue','profit','wealth','trade deficit','debt','bond',
      'gdp','currency','dollar','reserve','monetary policy','portfolio',
      'hedge','treasury','interest rate','inflation','market cap',
      'asset','commodity','equity','valuation','ipo','venture capital',
      'private equity','balance sheet','cash flow'
    ]
  },
  {
    tag: 'Geopolitics',
    kws: [
      'geopolit','sanction','warfare','military','nation state',
      'international relat','iran','russia','nato','cold war',
      'diplomac','foreign policy','tariff','us-china','china\'s',
      'taiwan','sovereignty','empire','coloniz','treaty','alliance',
      'trade war','election','superpower','pentagon','espionage',
      'intelligence','surveillance','arms','nuclear'
    ]
  },
  {
    tag: 'Leadership',
    kws: [
      'leadership','leader ','leading ','manag','executive',
      'ceo ','ceo\'s','chairman','president','authority',
      'command','direct','vision','decision-mak','board of directors',
      'founder\'s','mentorship','delegation','accountability',
      'organizational','culture','team building'
    ]
  },
  {
    tag: 'Strategy',
    kws: [
      'strateg','competitive advantage','tactic','positioning',
      'market share','business model','framework','long-term plan',
      'execution','blueprint','roadmap','pivot','moat',
      'differentiat','go-to-market','product-market fit',
      'scaling','monopol','vertical integration','expansion'
    ]
  },
  {
    tag: 'Entrepreneurship',
    kws: [
      'startup','entrepreneur','founder','venture','amazon',
      'microsoft','apple','bezos','musk','zuckerberg','gates',
      'build a company','company\'s growth','business empire',
      'self-made','hustle','risk-taking','bootstrapp','scale',
      'product launch','early stage','series a','series b'
    ]
  },
  {
    tag: 'History',
    kws: [
      'histor','rockefeller','carnegie','jp morgan','j.p. morgan',
      'william randolph hearst','p.t. barnum','shackleton',
      'estée lauder','hershey','sam colt','alexander graham bell',
      'teddy roosevelt','ancient','empire','civil war','world war',
      'colonial','dynasty','nineteenth century','19th century',
      '20th century','1800s','1900s','gilded age','industrial age',
      'golden age'
    ]
  },
  {
    tag: 'Innovation',
    kws: [
      'innovat','invent','disrupt','pioneer','breakthrough',
      'patent','revolutioniz','r&d','research','discovery',
      'new product','transform','novel approach','first time',
      'unprecedented','cutting-edge','state-of-the-art',
      'prototype','iteration','experimentation'
    ]
  },
  {
    tag: 'Psychology',
    kws: [
      'mindset','behavio','habit','psycholog','mental health',
      'cognitive','bias','emotion','motivat','wisdom','philosophy',
      'belief','principl','decision mak','human nature','character',
      'ego','self-aware','think','instinct','perception',
      'identity','resilient mind','stoic','mental model',
      'introspect','self-discipline'
    ]
  },
  {
    tag: 'Resilience',
    kws: [
      'resilience','resilient','persist','overcome','failure',
      'setback','recover','endure','adversity','struggle',
      'surviv','persever','grit','bounce back','hardship',
      'comeback','crisis','defeat','refusal to quit',
      'never give up','dark times','rebuilding','second chance'
    ]
  }
];

// ── Tag assignment ─────────────────────────────────────────────────────────
function assignTags(text) {
  const lower = text.toLowerCase();

  const scores = TAG_RULES.map(rule => {
    const score = rule.kws.reduce((sum, kw) => {
      let count = 0, pos = 0;
      while ((pos = lower.indexOf(kw, pos)) !== -1) { count++; pos += kw.length; }
      return sum + count;
    }, 0);
    return { tag: rule.tag, score };
  });

  scores.sort((a, b) => b.score - a.score);

  // Up to 4 tags; guarantee at least 2
  const tags = scores.filter(s => s.score > 0).slice(0, 4).map(s => s.tag);
  if (tags.length === 0) return ['Strategy', 'Leadership'];
  if (tags.length === 1) {
    const runner = scores.find(s => s.tag !== tags[0]);
    if (runner) tags.push(runner.tag);
  }
  return tags;
}

// ── Date helper ────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec'];

function getFileDate(filename) {
  try {
    const stat = fs.statSync(path.join(SUMMARIES_DIR, filename));
    const d = stat.mtime;
    return MONTHS[d.getMonth()] + ' ' + d.getDate();
  } catch { return '2025'; }
}

// ── Parser ─────────────────────────────────────────────────────────────────
const BULLET_RE = /^[•\-\*·▸▪▶►»◦‣]/;

function parseSummary(content, filename) {
  const lines = content.split('\n').map(l => l.trimEnd());

  // First non-empty line → title
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i >= lines.length) return null;

  const title = lines[i].trim();
  i++;
  if (!title || title.length < 3) return null;

  const sections = [];
  let cur = null;

  while (i < lines.length) {
    const raw = lines[i].trim();
    i++;

    if (!raw) continue;

    if (BULLET_RE.test(raw)) {
      // Bullet point
      const text = raw.replace(/^[•\-\*·▸▪▶►»◦‣]\s*/, '').trim();
      if (text.length > 5) {
        if (!cur) { cur = { h: 'Overview', b: [] }; sections.push(cur); }
        cur.b.push(text);
      }
      continue;
    }

    // Section header: not a URL, reasonable length, not a repeat of the title
    if (raw.length >= 4 && raw.length <= 220 && !/^https?:\/\//.test(raw)) {
      const cleanH = raw
        .replace(/^\d+[\.\)]\s+/, '')   // strip "1. " or "1) "
        .replace(/:$/, '')              // strip trailing colon
        .trim();

      if (cleanH.length >= 3 && cleanH !== title) {
        cur = { h: cleanH, b: [] };
        sections.push(cur);
      }
    }
  }

  // Keep only sections that have at least one bullet
  const validSecs = sections.filter(s => s.b.length > 0);
  if (!validSecs.length) return null;

  // Build corpus for tag scoring
  const corpus = [title, ...validSecs.map(s => s.h + ' ' + s.b.join(' '))].join(' ');

  return {
    w:   'RC',
    d:   getFileDate(filename),
    s:   title,
    t:   assignTags(corpus),
    sec: validSecs
  };
}

// ── Natural-sort helper (a1, a2, …, a10, …) ───────────────────────────────
function naturalSort(a, b) {
  const numA = parseInt(a.replace(/\D+/g, '')) || 0;
  const numB = parseInt(b.replace(/\D+/g, '')) || 0;
  return numA !== numB ? numA - numB : a.localeCompare(b);
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log('📂 Scanning:', SUMMARIES_DIR);

if (!fs.existsSync(SUMMARIES_DIR)) {
  console.error('❌  summaries/ directory not found at', SUMMARIES_DIR);
  process.exit(1);
}

if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

const files = fs.readdirSync(SUMMARIES_DIR)
  .filter(f => f.endsWith('.txt'))
  .sort(naturalSort);

console.log(`   Found ${files.length} .txt files`);

const summaries = [];
let id = 1, skipped = 0;

for (const file of files) {
  try {
    const content = fs.readFileSync(path.join(SUMMARIES_DIR, file), 'utf8');
    const parsed  = parseSummary(content, file);

    if (parsed) {
      parsed.id = id++;
      summaries.push(parsed);
    } else {
      skipped++;
      if (process.env.VERBOSE) console.warn('  ⚠  Skipped:', file);
    }
  } catch (err) {
    skipped++;
    console.warn('  ⚠  Error reading', file, ':', err.message);
  }
}

console.log(`✅  Parsed   ${summaries.length} summaries (${skipped} skipped)`);

// Tag distribution
const tagCounts = {};
summaries.forEach(s => s.t.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
console.log('\n📊 Tag distribution:');
Object.entries(tagCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([t, c]) => console.log(`   ${String(c).padStart(4, ' ')}  ${t}`));

const totalInsights = summaries.reduce(
  (s, e) => s + e.sec.reduce((a, x) => a + x.b.length, 0), 0
);
console.log(`\n💡 Total insights: ${totalInsights}`);

// Write
//const output = { summaries, xref: [], cols: [] };
const output = { summaries: summaries.slice().reverse(), xref: [], cols: [] };
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));
console.log(`\n💾 Written → ${OUTPUT_FILE}`);
console.log('Done! ✨\n');

