import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HOST = 'vpnjc.blog';
const BASE_URL = `https://${HOST}`;
const KEY = 'e0aadf4d5145454984d9d4478a87c0f4';
const KEY_FILENAME = `${KEY}.txt`;
const KEY_LOCATION = `${BASE_URL}/${KEY_FILENAME}`;
const DEFAULT_ENDPOINT = 'https://api.indexnow.org/indexnow';
const BATCH_LIMIT = 10000;

const rootDir = process.cwd();
const sitemapPath = path.join(rootDir, 'sitemap.xml');
const keyFilePath = path.join(rootDir, KEY_FILENAME);
const statePath = path.join(rootDir, '.indexnow-state.json');

/**
 * Parse CLI arguments into structured options.
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const opts = {
    dryRun: false,
    all: false,
    wait: false,
    gitDiff: false,
    baseRef: 'HEAD~1',
    endpoint: DEFAULT_ENDPOINT,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--all') opts.all = true;
    else if (arg === '--wait') opts.wait = true;
    else if (arg === '--git-diff') opts.gitDiff = true;
    else if (arg.startsWith('--base=')) opts.baseRef = arg.slice('--base='.length);
    else if (arg.startsWith('--endpoint=')) opts.endpoint = arg.slice('--endpoint='.length);
  }
  return opts;
}

/**
 * Extract `<loc>` and `<lastmod>` entries from sitemap.xml.
 * @param {string} xmlText
 * @returns {Array<{ loc: string, lastmod: string }>}
 */
function parseSitemapUrls(xmlText) {
  const entries = [];
  const seen = new Set();
  const urlBlockRe = /<url>\s*([\s\S]*?)<\/url>/g;
  for (const match of xmlText.matchAll(urlBlockRe)) {
    const block = match[1];
    const locMatch = block.match(/<loc>\s*([^<\s]+)\s*<\/loc>/);
    if (!locMatch) continue;
    const loc = locMatch[1].trim();
    if (!loc.startsWith(`${BASE_URL}/`) || seen.has(loc)) continue;
    seen.add(loc);
    const modMatch = block.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/);
    entries.push({ loc, lastmod: modMatch ? modMatch[1].trim() : '' });
  }
  return entries;
}

/**
 * Resolve changed sitemap URLs from git diff when `--git-diff` is active.
 * @param {Array<{ loc: string, lastmod: string }>} entries
 * @param {string} baseRef
 * @returns {Array<{ loc: string, lastmod: string }>}
 */
function selectUrlsFromGitDiff(entries, baseRef) {
  let diffOutput = '';
  try {
    diffOutput = execFileSync('git', ['diff', '--name-only', baseRef, 'HEAD'], {
      cwd: rootDir,
      encoding: 'utf8',
    });
  } catch {
    return entries;
  }

  const changedFiles = diffOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (changedFiles.includes(KEY_FILENAME)) {
    return entries;
  }

  const byLoc = new Map(entries.map((e) => [e.loc, e]));
  const selected = new Map();

  for (const file of changedFiles) {
    if (file === 'index.html') {
      const home = byLoc.get(`${BASE_URL}/`);
      if (home) selected.set(home.loc, home);
      continue;
    }

    let stem = null;
    if (file.endsWith('.html') && !file.includes('/')) {
      stem = file.slice(0, -5);
    } else if (file.endsWith('/index.html')) {
      stem = file.slice(0, -'/index.html'.length);
    }
    if (!stem) continue;

    for (const candidate of [`${BASE_URL}/${stem}`, `${BASE_URL}/${stem}.html`]) {
      const entry = byLoc.get(candidate);
      if (entry) selected.set(entry.loc, entry);
    }
  }

  return Array.from(selected.values());
}

/**
 * Select URLs needing submission based on CLI flags and local `.indexnow-state.json`.
 * @param {Array<{ loc: string, lastmod: string }>} entries
 * @param {ReturnType<parseArgs>} opts
 */
function selectTargetUrls(entries, opts) {
  if (opts.all) return entries;
  if (opts.gitDiff) return selectUrlsFromGitDiff(entries, opts.baseRef);

  if (!fs.existsSync(statePath)) return entries;
  try {
    const saved = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const prevUrls = saved.urls || {};
    return entries.filter((e) => prevUrls[e.loc] !== e.lastmod);
  } catch {
    return entries;
  }
}

/**
 * Verify that the live key verification file is deployed and serves the exact key.
 * @param {boolean} waitUntilReady
 */
async function verifyLiveKeyFile(waitUntilReady) {
  const maxAttempts = waitUntilReady ? 24 : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(KEY_LOCATION, {
        headers: { 'User-Agent': 'vpnjc-indexnow-submitter/1.0' },
      });
      const text = (await res.text()).trim();
      if (res.status === 200 && text === KEY) {
        return;
      }
      if (attempt === maxAttempts) {
        throw new Error(
          `Key verification check failed at ${KEY_LOCATION} (status=${res.status}, len=${text.length}).`,
        );
      }
    } catch (err) {
      if (attempt === maxAttempts) throw err;
    }
    console.log(`Waiting for live key file at ${KEY_LOCATION} (${attempt}/${maxAttempts})...`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(keyFilePath)) {
    throw new Error(`Missing local IndexNow key file: ${keyFilePath}`);
  }
  const localKey = fs.readFileSync(keyFilePath, 'utf8').trim();
  if (localKey !== KEY) {
    throw new Error(`Key file ${KEY_FILENAME} content mismatch.`);
  }
  if (!fs.existsSync(sitemapPath)) {
    throw new Error(`Missing sitemap.xml at ${sitemapPath}`);
  }

  const allEntries = parseSitemapUrls(fs.readFileSync(sitemapPath, 'utf8'));
  const targets = selectTargetUrls(allEntries, opts);

  console.log(
    `IndexNow summary: total=${allEntries.length} URLs in sitemap.xml, selected=${targets.length} to submit.`,
  );

  if (targets.length === 0) {
    console.log('No new or modified URLs to submit. Pass --all to submit all URLs.');
    return;
  }

  if (opts.dryRun) {
    console.log('Dry-run payload preview (first 5 URLs):', {
      host: HOST,
      key: KEY,
      keyLocation: KEY_LOCATION,
      urlCount: targets.length,
      sampleUrls: targets.slice(0, 5).map((t) => t.loc),
    });
    return;
  }

  await verifyLiveKeyFile(opts.wait);
  console.log(`Verified live key file at ${KEY_LOCATION}.`);

  for (let i = 0; i < targets.length; i += BATCH_LIMIT) {
    const batch = targets.slice(i, i + BATCH_LIMIT).map((t) => t.loc);
    const payload = {
      host: HOST,
      key: KEY,
      keyLocation: KEY_LOCATION,
      urlList: batch,
    };
    const res = await fetch(opts.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    if (res.status !== 200 && res.status !== 202) {
      throw new Error(`IndexNow API returned HTTP ${res.status}: ${body}`);
    }
    console.log(
      `Submitted batch (${batch.length} URLs) to ${opts.endpoint} -> HTTP ${res.status}${body ? ` (${body})` : ''}`,
    );
  }

  const urlMap = Object.fromEntries(allEntries.map((e) => [e.loc, e.lastmod]));
  fs.writeFileSync(
    statePath,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        host: HOST,
        keyLocation: KEY_LOCATION,
        count: allEntries.length,
        urls: urlMap,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  console.log(`Updated ${path.basename(statePath)} (${allEntries.length} URLs tracked).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
