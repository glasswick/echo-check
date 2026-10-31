#!/usr/bin/env node
// echo-check: is this new prompt a repeat of the agent's recent ones?
// For agents that write their own next prompt (a heartbeat, a subconscious, a planner):
// a model shown its own recent words tends to say them again.
//   echo-check check <new.txt|-> <history...> [--last N] [--threshold T] [--ignore file]... [--json]
//   echo-check scan <history.jsonl> [--last N] [--threshold T] [--field words]
// --ignore: text that repeats on purpose (a preamble, quoted rules); its phrases don't count.
// History: text files (one prompt each), or a .jsonl with one prompt per line in a field
// (--field, a dotted path such as message.content or messages.-1.content).
// Exit code 1 means it's an echo, so a loop can reject it and draw again. No dependencies.

import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const N = 4; // phrase length, in words

export function words(text) {
  return String(text ?? '').toLowerCase().replace(/[’']/g, "'").match(/[a-z0-9']+/g) ?? [];
}

function grams(ws, n = N) {
  const out = new Set();
  for (let i = 0; i + n <= ws.length; i++) out.add(ws.slice(i, i + n).join(' '));
  return out;
}

// Share of the new text's phrases already said in one earlier text.
export function overlap(text, earlier, ignore = new Set()) {
  const a = grams(words(text));
  for (const g of ignore) a.delete(g);
  if (!a.size) return 0;
  const b = grams(words(earlier));
  let hit = 0;
  for (const g of a) if (b.has(g)) hit++;
  return hit / a.size;
}

// The longest runs of words the new text shares with any earlier one.
export function sharedRuns(text, history, min = 6) {
  const ws = words(text);
  const runs = [];
  for (const h of history) {
    const set = grams(words(h), min);
    let i = 0;
    while (i + min <= ws.length) {
      if (!set.has(ws.slice(i, i + min).join(' '))) { i++; continue; }
      let j = i + min;
      while (j < ws.length && set.has(ws.slice(j - min + 1, j + 1).join(' '))) j++;
      runs.push(ws.slice(i, j).join(' '));
      i = j;
    }
  }
  return [...new Set(runs)].sort((x, y) => y.length - x.length).slice(0, 5);
}

// Text that repeats on purpose (a fixed preamble, quoted rules) shouldn't count.
export function ignoring(texts) {
  const out = new Set();
  for (const t of texts) for (const g of grams(words(t))) out.add(g);
  return out;
}

const STOP = new Set('about after again also because before being could every first other their there these thing things those through under until where which while would your yours yourself what when have from that this with will just only into than then them they were been does doing done make made more most much must need some such very'.split(' '));

// Words the new text shares with at least half of the history: a theme it keeps returning to,
// even in new phrasing. Information, not a verdict.
export function themes(text, history, ignore = new Set()) {
  if (history.length < 2) return [];
  const ignored = new Set([...ignore].flatMap((g) => g.split(' ')));
  const content = (t) => new Set(words(t).filter((w) => w.length >= 5 && !STOP.has(w) && !ignored.has(w)));
  const counts = new Map();
  for (const h of history) for (const w of content(h)) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...content(text)].filter((w) => counts.get(w) >= history.length / 2).sort();
}

export function echoOf(text, history, { threshold = 0.25, ignore = new Set() } = {}) {
  const scores = history.map((h, i) => ({ i, score: overlap(text, h, ignore) }));
  const worst = scores.reduce((m, s) => (s.score > m.score ? s : m), { i: -1, score: 0 });
  return { echo: worst.score >= threshold, score: worst.score, closest: worst.i, runs: sharedRuns(text, history), themes: themes(text, history, ignore) };
}

// A dotted path into a JSON line: "words", "message.content", "messages.-1.content" (negative counts from the end).
export function pick(obj, path) {
  let v = obj;
  for (const k of String(path).split('.')) {
    if (v == null) return undefined;
    v = Array.isArray(v) && /^-?\d+$/.test(k) ? v.at(Number(k)) : v[k];
  }
  return v;
}

function readHistory(paths, field, last) {
  const out = [];
  for (const p of paths) {
    const raw = readFileSync(p, 'utf8');
    if (p.endsWith('.jsonl')) {
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        try { const v = pick(JSON.parse(line), field); if (typeof v === 'string') out.push(v); } catch {}
      }
    } else out.push(raw);
  }
  return out.slice(-last);
}

function opts(argv) {
  const o = { last: 8, threshold: 0.25, field: 'words', json: false, rest: [], ignoreFiles: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--last') o.last = Number(argv[++i]);
    else if (argv[i] === '--threshold') o.threshold = Number(argv[++i]);
    else if (argv[i] === '--field') o.field = argv[++i];
    else if (argv[i] === '--ignore') o.ignoreFiles.push(argv[++i]);
    else if (argv[i] === '--json') o.json = true;
    else o.rest.push(argv[i]);
  }
  return o;
}

const pct = (x) => `${Math.round(x * 100)}%`;

function main(argv) {
  const [cmd, ...more] = argv;
  const o = opts(more);
  o.ignore = ignoring(o.ignoreFiles.map((f) => readFileSync(f, 'utf8')));
  if (cmd === 'check' && o.rest.length >= 2) {
    const [src, ...hist] = o.rest;
    const text = readFileSync(src === '-' ? 0 : src, 'utf8');
    const r = echoOf(text, readHistory(hist, o.field, o.last), o);
    if (o.json) console.log(JSON.stringify(r, null, 2));
    else {
      console.log(`${r.echo ? 'echo' : 'new'}: ${pct(r.score)} of its 4-word phrases were already said in one recent prompt (threshold ${pct(o.threshold)})`);
      for (const run of r.runs) console.log(`  repeated: "${run}"`);
      if (r.themes.length) console.log(`  keeps returning to: ${r.themes.join(', ')}`);
    }
    process.exitCode = r.echo ? 1 : 0;
  } else if (cmd === 'scan' && o.rest.length === 1) {
    const all = readHistory(o.rest, o.field, Infinity);
    let echoes = 0;
    for (let k = 1; k < all.length; k++) {
      const r = echoOf(all[k], all.slice(Math.max(0, k - o.last), k), o);
      if (r.echo) echoes++;
      if (!o.json) console.log(`${String(k).padStart(4)} ${r.echo ? 'ECHO' : '    '} ${pct(r.score).padStart(4)}  ${all[k].replace(/\s+/g, ' ').slice(0, 60)}${r.themes.length ? `  [${r.themes.join(', ')}]` : ''}`);
    }
    console.log(o.json ? JSON.stringify({ prompts: all.length, echoes }) : `\n${echoes} of ${all.length - 1} prompts echoed one of the ${o.last} before them`);
  } else {
    console.log('usage: echo-check check <new.txt|-> <history...> [--last N] [--threshold T] [--ignore file]... [--json]\n       echo-check scan <history.jsonl> [--last N] [--threshold T] [--field words] [--ignore file]...');
    process.exitCode = 2;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
